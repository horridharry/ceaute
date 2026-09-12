create table ceaute.booking_review (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references ceaute.booking (id) on delete restrict,
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  customer_profile_id uuid not null references ceaute.profile (id) on delete restrict,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  is_visible boolean not null default true,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, update (phone_e164, phone_verified_at) on ceaute.profile
to service_role;

create trigger booking_review_set_updated_at
before update on ceaute.booking_review
for each row execute function ceaute.set_updated_at();

create index booking_review_provider_visible_idx
  on ceaute.booking_review (provider_page_id, is_visible, created_at desc);

alter table ceaute.booking_review enable row level security;

revoke all on ceaute.booking_review from anon, authenticated;
grant select on ceaute.booking_review to authenticated;
grant select, insert, update on ceaute.booking_review to service_role;

create policy booking_review_select_customer_or_provider
on ceaute.booking_review
for select
to authenticated
using (
  customer_profile_id = (select auth.uid())
  or exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = booking_review.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create table ceaute.phone_verification_request (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references ceaute.profile (id) on delete restrict,
  phone_e164 varchar(20) not null,
  requested_at timestamptz not null default now()
);

alter table ceaute.phone_verification_request enable row level security;

revoke all on ceaute.phone_verification_request from anon, authenticated;
grant select, insert on ceaute.phone_verification_request to service_role;

create index phone_verification_request_profile_time_idx
  on ceaute.phone_verification_request (profile_id, requested_at desc);

create or replace function ceaute.clear_phone_verification_on_change()
returns trigger
language plpgsql
set search_path = ceaute, public
as $$
begin
  if new.phone_e164 is distinct from old.phone_e164 then
    new.phone_verified_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists profile_clear_phone_verification_on_change on ceaute.profile;

create trigger profile_clear_phone_verification_on_change
before update of phone_e164 on ceaute.profile
for each row execute function ceaute.clear_phone_verification_on_change();

create or replace function ceaute.create_booking_review(
  target_booking_id uuid,
  review_rating integer,
  review_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_booking ceaute.booking%rowtype;
  current_profile ceaute.profile%rowtype;
  cleaned_comment text;
  review_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if review_rating < 1 or review_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = target_booking_id
  for update;

  if target_booking.id is null
    or target_booking.customer_profile_id <> current_profile_id then
    raise exception 'Booking not found.';
  end if;

  if target_booking.status <> 'completed' then
    raise exception 'Only completed bookings can be reviewed.';
  end if;

  if exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_booking.provider_page_id
      and provider_page.owner_profile_id = current_profile_id
  ) then
    raise exception 'You cannot review your own provider page.';
  end if;

  select * into current_profile
  from ceaute.profile
  where id = current_profile_id;

  if current_profile.phone_e164 is null
    or current_profile.phone_verified_at is null then
    raise exception 'Verify your phone number before reviewing.';
  end if;

  cleaned_comment := nullif(btrim(coalesce(review_comment, '')), '');

  if length(coalesce(cleaned_comment, '')) > 1000 then
    raise exception 'Review comments must be 1000 characters or fewer.';
  end if;

  insert into ceaute.booking_review (
    booking_id,
    provider_page_id,
    customer_profile_id,
    rating,
    comment
  )
  values (
    target_booking.id,
    target_booking.provider_page_id,
    current_profile_id,
    review_rating,
    cleaned_comment
  )
  on conflict (booking_id) do nothing
  returning id into review_id;

  if review_id is null then
    select id into review_id
    from ceaute.booking_review
    where booking_id = target_booking.id
      and customer_profile_id = current_profile_id;
  end if;

  if review_id is null then
    raise exception 'Review could not be saved.';
  end if;

  return review_id;
end;
$$;

create or replace function ceaute.set_booking_review_visibility(
  target_review_id uuid,
  visible boolean
)
returns void
language sql
security definer
set search_path = ceaute, public
as $$
  update ceaute.booking_review
  set is_visible = visible,
      hidden_at = case when visible then null else now() end
  where id = target_review_id;
$$;

revoke all on function ceaute.clear_phone_verification_on_change()
from public, anon, authenticated;
revoke all on function ceaute.create_booking_review(uuid, integer, text)
from public, anon, authenticated;
revoke all on function ceaute.set_booking_review_visibility(uuid, boolean)
from public, anon, authenticated;

grant execute on function ceaute.create_booking_review(uuid, integer, text)
to authenticated;
grant execute on function ceaute.set_booking_review_visibility(uuid, boolean)
to service_role;
