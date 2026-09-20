-- Beauty customers routinely want to show a provider the result they are after.
-- An inspiration image is a private attachment to one booking: not portfolio,
-- not a review, not public, and never required in order to book.
--
-- Two things make this different from the portfolio images beside it. They
-- belong to the customer rather than the provider, so ownership is resolved
-- through the booking; and the ones attached to a booking that never gets paid
-- for are temporary, so the booking lifecycle has to be able to take them away
-- again.

create table ceaute.booking_inspiration_image (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references ceaute.booking (id) on delete restrict,
  -- The five-image limit is this column, not a counted check. Counting rows
  -- before inserting lets two uploads race past the limit; five numbered places
  -- per booking cannot be raced, because the sixth has nowhere to go.
  slot smallint not null check (slot between 1 and 5),
  storage_path text not null unique,
  content_type text not null check (
    content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, slot),
  unique (id, booking_id)
);

create index booking_inspiration_image_booking_idx
  on ceaute.booking_inspiration_image (booking_id, created_at, slot);

create trigger booking_inspiration_image_set_updated_at
before update on ceaute.booking_inspiration_image
for each row execute function ceaute.set_updated_at();

alter table ceaute.booking_inspiration_image enable row level security;

-- Who may do what ------------------------------------------------------------

-- These answer the authorization question once, for the table policies, for the
-- Storage policies, and for the trusted insert below. `authenticated` holds no
-- privilege whatsoever on ceaute.booking — 202609120013 revoked it so that
-- snapshots could not be read directly — so a policy cannot join to it. Asking
-- through a security definer function is what lets a policy answer the question
-- without reopening the booking table to clients.

-- The customer owns these images while the appointment is still ahead of them.
-- Once it is completed or cancelled the booking is history, and history is read
-- only: no adding, no removing, no replacing.
create or replace function ceaute.can_manage_booking_inspiration_images(
  target_booking_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select exists (
    select 1
    from ceaute.booking
    where booking.id = target_booking_id
      and booking.customer_profile_id = (select auth.uid())
      and (
        (booking.status = 'awaiting_payment' and booking.expires_at > now())
        or booking.status = 'confirmed'
      )
  );
$$;

-- The customer always sees their own. The provider sees the ones attached to an
-- appointment they were actually engaged for, which is what confirmed_at
-- records, and keeps seeing them afterwards as part of the historical booking.
-- A hold somebody abandoned was never their appointment.
create or replace function ceaute.can_view_booking_inspiration_images(
  target_booking_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select exists (
    select 1
    from ceaute.booking
    where booking.id = target_booking_id
      and booking.customer_profile_id = (select auth.uid())
  ) or exists (
    select 1
    from ceaute.booking
    join ceaute.provider_page
      on provider_page.id = booking.provider_page_id
    where booking.id = target_booking_id
      and provider_page.owner_profile_id = (select auth.uid())
      and booking.confirmed_at is not null
  );
$$;

revoke all on function ceaute.can_manage_booking_inspiration_images(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.can_view_booking_inspiration_images(uuid)
from public, anon, authenticated, service_role;

grant execute on function ceaute.can_manage_booking_inspiration_images(uuid)
to authenticated;
grant execute on function ceaute.can_view_booking_inspiration_images(uuid)
to authenticated;

revoke all on table ceaute.booking_inspiration_image from anon, authenticated;

-- Reading and removing are ordinary row operations. Adding is not: it has to
-- find a free place among the five, and that is the limit, so it goes through
-- the operation below rather than an INSERT grant.
grant select, delete on table ceaute.booking_inspiration_image to authenticated;

grant select on table ceaute.booking_inspiration_image to service_role;
grant delete on table ceaute.booking_inspiration_image to service_role;

create policy booking_inspiration_image_select_participant
on ceaute.booking_inspiration_image
for select
to authenticated
using (ceaute.can_view_booking_inspiration_images(booking_id));

create policy booking_inspiration_image_delete_owning_customer
on ceaute.booking_inspiration_image
for delete
to authenticated
using (ceaute.can_manage_booking_inspiration_images(booking_id));

-- Every policy on storage.objects is evaluated for every bucket, and SQL does
-- not promise to stop at a failing bucket_id before evaluating the rest of the
-- condition. A path whose first segment is not a uuid must therefore answer
-- "no", not raise: an error inside a policy aborts the whole statement, which
-- would turn a malformed path here into a failure for an unrelated bucket.
create or replace function ceaute.storage_object_booking_id(object_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif((storage.foldername(object_name))[1], '')::uuid;
exception when others then
  return null;
end;
$$;

revoke all on function ceaute.storage_object_booking_id(text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.storage_object_booking_id(text)
to authenticated;

-- Adding one ------------------------------------------------------------------

create or replace function ceaute.add_booking_inspiration_image(
  target_booking_id uuid,
  target_storage_path text,
  target_content_type text,
  target_byte_size bigint
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  next_slot smallint;
  new_image_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not ceaute.can_manage_booking_inspiration_images(target_booking_id) then
    raise exception 'This booking cannot take inspiration images.';
  end if;

  -- The row is what the cleanup pass reads when it deletes files, so a row must
  -- never be able to name a file belonging to another booking. Storage's own
  -- policies already refuse the upload; this refuses the record of one, which
  -- is the half that could otherwise be created on its own.
  if ceaute.storage_object_booking_id(target_storage_path)
    is distinct from target_booking_id then
    raise exception 'An inspiration image must be stored under its own booking.';
  end if;

  -- The limit is the five places; this only picks one. Two uploads racing for
  -- the same place is not a problem to prevent, because the unique constraint
  -- decides it, and the caller retries or reports it.
  select min(candidate_slot) into next_slot
  from generate_series(1, 5) as candidate_slot
  where not exists (
    select 1
    from ceaute.booking_inspiration_image
    where booking_inspiration_image.booking_id = target_booking_id
      and booking_inspiration_image.slot = candidate_slot
  );

  if next_slot is null then
    raise exception 'A booking can have at most five inspiration images.'
      using errcode = 'check_violation';
  end if;

  insert into ceaute.booking_inspiration_image (
    booking_id, slot, storage_path, content_type, byte_size
  ) values (
    target_booking_id, next_slot, target_storage_path, target_content_type, target_byte_size
  )
  returning id into new_image_id;

  return new_image_id;
end;
$$;

revoke all on function ceaute.add_booking_inspiration_image(uuid, text, text, bigint)
from public, anon, authenticated, service_role;

grant execute on function ceaute.add_booking_inspiration_image(uuid, text, text, bigint)
to authenticated;

-- Taking them away again -------------------------------------------------------

-- Entering the booking flow and walking away must not leave anything behind.
-- These two are the database half of that: one names the images whose booking
-- died before it was ever paid for, the other forgets them once the trusted
-- backend has removed the files. They are separate because deleting a Storage
-- object is an HTTP call that PostgreSQL cannot make, and because doing it in
-- that order means a crash in between leaves a row to retry rather than a file
-- nobody remembers.

create or replace function ceaute.list_discardable_booking_inspiration_images(
  max_images integer default 200
)
returns table (
  id uuid,
  booking_id uuid,
  storage_path text
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select
    booking_inspiration_image.id,
    booking_inspiration_image.booking_id,
    booking_inspiration_image.storage_path
  from ceaute.booking_inspiration_image
  join ceaute.booking
    on booking.id = booking_inspiration_image.booking_id
  where booking.confirmed_at is null
    and (
      booking.status = 'cancelled'
      -- A grace period, because expiry and confirmation are decided against
      -- different snapshots. ceaute.complete_booking_payment_attempt confirms
      -- only while expires_at is still ahead, so a payment already in flight
      -- across the instant a hold runs out could otherwise have its files taken
      -- away by a pass that read the clock a moment later, leaving a real
      -- appointment with records pointing at nothing. A hold cancelled outright
      -- needs no grace: nothing can confirm it afterwards.
      or (
        booking.status = 'awaiting_payment'
        and booking.expires_at <= now() - interval '5 minutes'
      )
    )
  order by booking_inspiration_image.created_at
  limit greatest(1, least(coalesce(max_images, 200), 500));
$$;

create or replace function ceaute.discard_booking_inspiration_images(
  target_image_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  discarded_count integer;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  -- The predicate is repeated rather than trusted from the caller: an image id
  -- that has since become part of a paid booking must not be forgotten because
  -- it was named in a list drawn up moments earlier.
  with discarded_images as (
    delete from ceaute.booking_inspiration_image
    where booking_inspiration_image.id = any(coalesce(target_image_ids, array[]::uuid[]))
      and exists (
        select 1
        from ceaute.booking
        where booking.id = booking_inspiration_image.booking_id
          and booking.confirmed_at is null
          and (
            booking.status = 'cancelled'
            or (
              booking.status = 'awaiting_payment'
              and booking.expires_at <= now() - interval '5 minutes'
            )
          )
      )
    returning 1
  )
  select count(*) into discarded_count from discarded_images;

  return discarded_count;
end;
$$;

revoke all on function ceaute.list_discardable_booking_inspiration_images(integer)
from public, anon, authenticated, service_role;
revoke all on function ceaute.discard_booking_inspiration_images(uuid[])
from public, anon, authenticated, service_role;

grant execute on function ceaute.list_discardable_booking_inspiration_images(integer)
to service_role;
grant execute on function ceaute.discard_booking_inspiration_images(uuid[])
to service_role;

-- Storage ----------------------------------------------------------------------

-- Private, like the portfolio bucket beside it, and reached only through signed
-- URLs. The size and type limits are repeated here because the bucket enforces
-- them on the object itself, whatever the application forgot to check.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'booking-inspiration-images',
  'booking-inspiration-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects are filed under the booking they belong to, so the path itself says
-- who may reach them and carries nothing about the customer.

create policy booking_inspiration_images_select_participant
on storage.objects
for select
to authenticated
using (
  bucket_id = 'booking-inspiration-images'
  and ceaute.can_view_booking_inspiration_images(
    ceaute.storage_object_booking_id(name)
  )
);

create policy booking_inspiration_images_insert_owning_customer
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'booking-inspiration-images'
  and ceaute.can_manage_booking_inspiration_images(
    ceaute.storage_object_booking_id(name)
  )
);

create policy booking_inspiration_images_delete_owning_customer
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'booking-inspiration-images'
  and ceaute.can_manage_booking_inspiration_images(
    ceaute.storage_object_booking_id(name)
  )
);

-- There is deliberately no update policy. Replacing an image is removing one
-- and adding another, which keeps the row and the object in step.

comment on table ceaute.booking_inspiration_image is
  'Private reference images a customer attaches to their own booking. At most five per booking, read-only once the booking is completed or cancelled, and discarded with the booking if it is never paid for.';
