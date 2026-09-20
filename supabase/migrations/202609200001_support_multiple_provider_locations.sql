-- A provider may now save several locations and operate from exactly one of
-- them at a time. This is not a multi-location booking system: customers never
-- choose a location, availability stays provider-wide, and treatments stay
-- provider-wide. The saved list exists so a provider who moves — to university,
-- to another city, abroad for a season — can change where new bookings take
-- place without rebuilding their page.
--
-- Which saved location is current is therefore provider operating state, not a
-- form field. It moves only through ceaute.set_primary_provider_location, which
-- also retires the in-progress holds the move has made stale. That retirement
-- is deliberately the same transition ceaute.expire_provider_booking_holds
-- already performs on a hold whose time has run out, so every consequence
-- downstream — the checkout screen, the Checkout claim, and a late Stripe
-- payment turning into a refund entitlement — is behaviour that already exists.

-- Saved locations ------------------------------------------------------------

alter table ceaute.provider_location
  add column if not exists is_primary boolean not null default false;

-- One row per provider page was the old model. Saving a second location is the
-- feature, so the constraint that forbade it goes; the partial unique index
-- below keeps the part of it that still matters.
alter table ceaute.provider_location
  drop constraint if exists provider_location_provider_page_id_key;

create unique index if not exists provider_location_one_primary_per_page_idx
  on ceaute.provider_location (provider_page_id)
  where is_primary;

create index if not exists provider_location_provider_page_idx
  on ceaute.provider_location (provider_page_id, created_at, id);

-- Discovery reads the current location only, so the area index follows it.
drop index if exists ceaute.provider_location_public_area_idx;

create index if not exists provider_location_public_area_idx
  on ceaute.provider_location (lower(public_area))
  where is_active and is_primary;

-- Existing environments hold at most one location per provider page, because
-- the constraint dropped above allowed no more, and that row is where the
-- provider currently works. The window function is not defensive dressing: it
-- means this migration still leaves exactly one primary per page if it is ever
-- applied to a database that somehow already holds more than one row for a
-- page, which is the only way the index above could reject it.
with ranked_locations as (
  select
    id,
    row_number() over (
      partition by provider_page_id
      order by is_active desc, created_at, id
    ) as location_rank
  from ceaute.provider_location
)
update ceaute.provider_location
set is_primary = true
from ranked_locations
where ranked_locations.id = provider_location.id
  and ranked_locations.location_rank = 1
  and provider_location.is_primary = false
  -- Idempotent: a page that already has a current location keeps it, so
  -- re-running this file after a provider has moved is a no-op rather than a
  -- unique violation that would name the wrong location anyway.
  and not exists (
    select 1
    from ceaute.provider_location as existing_location
    where existing_location.provider_page_id = provider_location.provider_page_id
      and existing_location.is_primary
  );

-- The first saved location is the provider's current one because there is
-- nothing else it could be. Computing it here rather than trusting the caller
-- means no client, privileged or not, can insert a second primary.
create or replace function ceaute.set_first_provider_location_primary()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  new.is_primary := not exists (
    select 1
    from ceaute.provider_location
    where provider_location.provider_page_id = new.provider_page_id
      and provider_location.is_primary
  );

  return new;
end;
$$;

drop trigger if exists provider_location_set_first_primary on ceaute.provider_location;

create trigger provider_location_set_first_primary
before insert on ceaute.provider_location
for each row execute function ceaute.set_first_provider_location_primary();

-- Deleting the location you are currently working from would leave the page
-- published with nowhere for an appointment to happen. Make another location
-- current first. A provider with one location therefore cannot delete it here;
-- taking a page out of service is unpublishing, which already exists.
create or replace function ceaute.protect_primary_provider_location()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if old.is_primary then
    raise exception 'The current location cannot be deleted. Make another saved location current first.'
      using errcode = 'restrict_violation';
  end if;

  return old;
end;
$$;

drop trigger if exists provider_location_protect_primary on ceaute.provider_location;

create trigger provider_location_protect_primary
before delete on ceaute.provider_location
for each row execute function ceaute.protect_primary_provider_location();

-- A provider edits the details of a saved location and deletes one they have
-- left. Two columns are deliberately not in that list. is_primary changes only
-- through the operation below, which is the only thing that can keep the
-- booking side consistent with a move. is_active is not a provider-facing idea
-- at all — no screen writes it, it defaults to true, and leaving it writable
-- would let a provider deactivate the very location their published page is
-- taking bookings against.
revoke insert, update on table ceaute.provider_location from authenticated;

grant insert (
  provider_page_id,
  public_area,
  address_line_1,
  address_line_2,
  city,
  postcode,
  country_code,
  access_instructions
) on table ceaute.provider_location to authenticated;

grant update (
  public_area,
  address_line_1,
  address_line_2,
  city,
  postcode,
  access_instructions
) on table ceaute.provider_location to authenticated;

grant delete on table ceaute.provider_location to authenticated;

create policy provider_location_delete_own_provider
on ceaute.provider_location
for delete
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_location.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

-- Which location a hold was taken against -----------------------------------

-- The address a booking is honoured at is, and stays, the flat snapshot in
-- service_snapshot: that is what ADR 002 protects, and it survives this
-- location being edited or deleted. This column answers a different question —
-- which saved location was current when the hold was taken — so that a later
-- move can tell a stale hold from a compatible one.
--
-- It carries no foreign key on purpose. A booking must never stand in the way
-- of deleting a location the provider has left, and deleting one must never
-- write to a booking row; a plain identifier does both by doing nothing. The
-- value may therefore name a row that no longer exists, which is harmless
-- because nothing resolves it — only ceaute.set_primary_provider_location
-- compares it, and only for a hold that has yet to be paid.
alter table ceaute.booking
  add column if not exists provider_location_id uuid;

comment on column ceaute.booking.provider_location_id is
  'The saved location current when the hold was taken. Not a foreign key: deleting a location must never touch a booking. The appointment address itself lives in service_snapshot.';

-- What makes a location usable as the place a published page takes bookings at.
-- Publication asked this question before this feature; moving and holding a
-- booking now ask the same one, in the same words, so the three cannot drift.
create or replace function ceaute.provider_location_is_complete(
  location_is_active boolean,
  location_public_area text,
  location_address_line_1 text,
  location_city text,
  location_postcode text
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(location_is_active, false)
    and nullif(btrim(location_public_area), '') is not null
    and nullif(btrim(location_address_line_1), '') is not null
    and nullif(btrim(location_city), '') is not null
    and nullif(btrim(location_postcode), '') is not null;
$$;

-- Changing where you work --------------------------------------------------

create or replace function ceaute.set_primary_provider_location(
  target_location_id uuid
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_page_id uuid;
  target_page_status text;
  target_location ceaute.provider_location%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  -- Lock the provider page first, and only then its locations.
  -- ceaute.create_validated_booking_hold takes the same two rows in the same
  -- order, so a customer taking a hold and a provider moving cannot deadlock,
  -- and cannot interleave: whichever commits first, the other sees it. A hold
  -- taken just before the move is swept below; a hold taken just after it is
  -- snapshotted against the location the provider has just moved to.
  select provider_page.id, provider_page.status
  into target_page_id, target_page_status
  from ceaute.provider_location
  join ceaute.provider_page
    on provider_page.id = provider_location.provider_page_id
  where provider_location.id = target_location_id
    and provider_page.owner_profile_id = current_profile_id
  for update of provider_page;

  if target_page_id is null then
    raise exception 'Location not found.';
  end if;

  -- Every saved location for this page, so two concurrent changes cannot
  -- interleave into two primaries or none.
  perform 1
  from ceaute.provider_location
  where provider_location.provider_page_id = target_page_id
  for update;

  select * into target_location
  from ceaute.provider_location
  where provider_location.id = target_location_id
    and provider_location.provider_page_id = target_page_id;

  if target_location.id is null then
    raise exception 'Location not found.';
  end if;

  if target_location.is_primary then
    return;
  end if;

  -- A published page is taking bookings right now, and every new one is
  -- snapshotted against wherever it says the provider is. Moving it onto a
  -- location with no address would sell appointments to nowhere, so it is
  -- refused here rather than discovered by a customer. A draft page may move
  -- freely; publication asks the same question again before it goes live.
  if target_page_status = 'published'
    and not ceaute.provider_location_is_complete(
      target_location.is_active,
      target_location.public_area,
      target_location.address_line_1,
      target_location.city,
      target_location.postcode
    ) then
    raise exception 'A published page can only work from a location with a public area and a complete private address.'
      using errcode = 'check_violation';
  end if;

  update ceaute.provider_location
  set is_primary = false
  where provider_location.provider_page_id = target_page_id
    and provider_location.id <> target_location.id
    and provider_location.is_primary;

  update ceaute.provider_location
  set is_primary = true
  where provider_location.id = target_location.id;

  -- Where the appointment happens was settled when the hold was taken, and the
  -- customer has already been shown it. A hold held against a location the
  -- provider no longer works from cannot be honoured, so it stops being payable
  -- in the same breath as the move. That is deliberately the same transition
  -- ceaute.expire_provider_booking_holds performs on a hold whose time has run
  -- out, so the checkout screen, the Checkout claim, and a payment that lands
  -- anyway all behave as they already do for an expired hold — including
  -- turning that payment into a full refund entitlement rather than a booking
  -- at the wrong address. Holds taken before this migration carry no location
  -- and cannot be shown to be compatible, so they are retired too.
  --
  -- Confirmed bookings are deliberately untouched. Their location is part of
  -- the agreed contract: the provider honours it or cancels it through the
  -- cancellation path that already exists.
  update ceaute.booking
  set status = 'cancelled'
  where booking.provider_page_id = target_page_id
    and booking.status = 'awaiting_payment'
    and booking.provider_location_id is distinct from target_location.id;
end;
$$;

revoke all on function ceaute.set_primary_provider_location(uuid)
from public, anon, authenticated, service_role;

grant execute on function ceaute.set_primary_provider_location(uuid)
to authenticated;

comment on function ceaute.set_primary_provider_location(uuid) is
  'Moves a provider to another saved location and retires the in-progress holds that move invalidates.';

-- Everything that reads "the provider''s location" ---------------------------

-- Publication asks for a complete current location, not merely a complete
-- saved one: the page advertises where the provider works now.
create or replace function ceaute.provider_page_meets_publication_requirements(
  target_provider_page_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and (provider_page.status = 'draft' or provider_page.status = 'published')
      and nullif(btrim(provider_page.display_name), '') is not null
      and nullif(btrim(provider_page.username), '') is not null
      and nullif(btrim(provider_page.provider_category), '') is not null
      and nullif(btrim(provider_page.biography), '') is not null
      and exists (
        select 1
        from ceaute.provider_location
        where provider_location.provider_page_id = provider_page.id
          and provider_location.is_primary = true
          and ceaute.provider_location_is_complete(
            provider_location.is_active,
            provider_location.public_area,
            provider_location.address_line_1,
            provider_location.city,
            provider_location.postcode
          )
      )
      and exists (
        select 1
        from ceaute.availability_rule
        where availability_rule.provider_page_id = provider_page.id
      )
      and exists (
        select 1
        from ceaute.treatment
        where treatment.provider_page_id = provider_page.id
          and treatment.is_active = true
          and treatment.discovery_category_id is not null
          and treatment.price_pence > 0
          and treatment.duration_minutes > 0
      )
      and exists (
        select 1
        from ceaute.provider_booking_setting
        where provider_booking_setting.provider_page_id = provider_page.id
          and (
            provider_booking_setting.payment_mode = 'full'
            or provider_booking_setting.payment_mode = 'fixed_deposit'
          )
          and (
            provider_booking_setting.cancellation_window_hours = 12
            or provider_booking_setting.cancellation_window_hours = 24
            or provider_booking_setting.cancellation_window_hours = 48
          )
          and provider_booking_setting.commitment_amount_pence is not null
          and provider_booking_setting.commitment_amount_pence >= 0
      )
      and exists (
        select 1
        from ceaute.portfolio_image
        where portfolio_image.provider_page_id = provider_page.id
          and portfolio_image.is_visible = true
      )
      and exists (
        select 1
        from ceaute.provider_payment_account
        where provider_payment_account.provider_page_id = provider_page.id
          and provider_payment_account.recipient_applied = true
          and provider_payment_account.stripe_transfers_status = 'active'
          and provider_payment_account.payouts_status = 'active'
      )
  );
$$;

-- The public area a customer sees is the current location's.
create or replace function ceaute.get_public_provider_location(
  target_provider_page_id uuid
)
returns table (
  public_area varchar
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select provider_location.public_area
  from ceaute.provider_location
  join ceaute.provider_page
    on provider_page.id = provider_location.provider_page_id
  where provider_location.provider_page_id = target_provider_page_id
    and provider_location.is_primary = true
    and provider_page.status = 'published'
  limit 1;
$$;

comment on function ceaute.get_public_provider_location(uuid) is
  'Public projection: returns the current location''s public area only for a published provider page.';

-- Discovery matches a provider on where they work now. Joining every saved
-- location would list the same provider once per place they have ever saved,
-- and would keep finding them in a city they have left.
create or replace function ceaute.search_public_providers(
  area_query text default null,
  discovery_category_slug_query text default null
)
returns table (
  username varchar,
  display_name varchar,
  provider_category varchar,
  public_area varchar,
  portfolio_storage_path text,
  matching_treatments jsonb
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  with normalized_input as (
    select
      nullif(left(btrim(coalesce(area_query, '')), 120), '') as area,
      nullif(left(btrim(coalesce(discovery_category_slug_query, '')), 100), '') as category_slug
  ),
  selected_category as (
    select discovery_category.id
    from ceaute.discovery_category, normalized_input
    where discovery_category.is_active = true
      and discovery_category.slug = normalized_input.category_slug
  ),
  matched_providers as (
    select
      provider_page.id,
      provider_page.username,
      provider_page.display_name,
      provider_page.provider_category,
      provider_location.public_area
    from ceaute.provider_page
    join ceaute.provider_location
      on provider_location.provider_page_id = provider_page.id
      and provider_location.is_active = true
      and provider_location.is_primary = true
    cross join normalized_input
    where provider_page.status = 'published'
      and provider_page.username is not null
      and (
        normalized_input.area is null
        or lower(provider_location.public_area) like '%' || replace(replace(replace(lower(normalized_input.area), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
      and (
        normalized_input.category_slug is null
        or (
          exists (select 1 from selected_category)
          and exists (
            select 1
            from ceaute.treatment
            join selected_category
              on selected_category.id = treatment.discovery_category_id
            where treatment.provider_page_id = provider_page.id
              and treatment.is_active = true
          )
        )
      )
      and exists (
        select 1
        from ceaute.treatment
        where treatment.provider_page_id = provider_page.id
          and treatment.is_active = true
      )
  )
  select
    matched_providers.username,
    matched_providers.display_name,
    matched_providers.provider_category,
    matched_providers.public_area,
    (
      select portfolio_image.storage_path
      from ceaute.portfolio_image
      where portfolio_image.provider_page_id = matched_providers.id
        and portfolio_image.is_visible = true
      order by portfolio_image.display_order, portfolio_image.created_at
      limit 1
    ) as portfolio_storage_path,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', treatment.name,
            'price_pence', treatment.price_pence
          )
          order by treatment.display_order, treatment.name
        )
        from ceaute.treatment
        cross join normalized_input
        left join selected_category
          on true
        where treatment.provider_page_id = matched_providers.id
          and treatment.is_active = true
          and (
            normalized_input.category_slug is null
            or (
              selected_category.id is not null
              and treatment.discovery_category_id = selected_category.id
            )
          )
      ),
      '[]'::jsonb
    ) as matching_treatments
  from matched_providers
  order by matched_providers.display_name, matched_providers.username;
$$;

revoke all on function ceaute.search_public_providers(text, text)
from public, anon, authenticated;

grant execute on function ceaute.search_public_providers(text, text)
to anon, authenticated, service_role;

-- The booking contract -------------------------------------------------------

-- Unchanged apart from two things: the hold is snapshotted against the
-- provider's current location rather than any active one, and the snapshot now
-- records which saved location that was. The id is what lets a later move tell
-- a stale hold from a compatible one; the address fields beside it are still
-- what makes the booking readable after that location is edited or deleted.
create or replace function ceaute.create_validated_booking_hold(
  target_customer_profile_id uuid,
  target_provider_page_id uuid,
  target_treatment_id uuid,
  selected_add_on_ids uuid[],
  requested_start_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  customer_profile ceaute.profile%rowtype;
  customer_email text;
  provider_page ceaute.provider_page%rowtype;
  selected_treatment ceaute.treatment%rowtype;
  location ceaute.provider_location%rowtype;
  booking_setting ceaute.provider_booking_setting%rowtype;
  availability_rule ceaute.availability_rule%rowtype;
  unique_add_on_ids uuid[];
  selected_add_ons jsonb;
  selected_add_on_count integer;
  total_duration_minutes integer;
  total_price_pence bigint;
  requested_end_at timestamptz;
  requested_local_start timestamp;
  requested_local_end timestamp;
  current_local_date date := (now() at time zone 'Europe/London')::date;
  hold_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if target_customer_profile_id is null
    or target_provider_page_id is null
    or target_treatment_id is null
    or requested_start_at is null then
    raise exception 'Complete booking details are required.';
  end if;

  select * into customer_profile
  from ceaute.profile
  where id = target_customer_profile_id;

  select email into customer_email
  from auth.users
  where id = target_customer_profile_id;

  if customer_profile.id is null
    or nullif(btrim(customer_profile.full_name), '') is null
    or nullif(btrim(customer_profile.phone_e164), '') is null
    or nullif(btrim(customer_email), '') is null then
    raise exception 'Customer details are incomplete.';
  end if;

  select * into provider_page
  from ceaute.provider_page
  where id = target_provider_page_id
    and status = 'published'
  for share;

  if provider_page.id is null then
    raise exception 'Provider page not found.';
  end if;

  -- Retiring this provider's timed-out holds writes to ceaute.booking, so it
  -- has to happen after the page row above is locked, never before. The other
  -- writer of these two tables, ceaute.set_primary_provider_location, takes
  -- them in that same order; taking them in the other order here is what would
  -- let the two deadlock.
  perform ceaute.expire_provider_booking_holds(target_provider_page_id);

  select * into selected_treatment
  from ceaute.treatment
  where id = target_treatment_id
    and provider_page_id = target_provider_page_id
    and is_active = true
  for share;

  if selected_treatment.id is null then
    raise exception 'Treatment not available.';
  end if;

  unique_add_on_ids := coalesce(
    array(select distinct unnest(coalesce(selected_add_on_ids, array[]::uuid[]))),
    array[]::uuid[]
  );

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', treatment_add_on.id,
      'name', treatment_add_on.name,
      'additional_price_pence', treatment_add_on.additional_price_pence,
      'additional_duration_minutes', treatment_add_on.additional_duration_minutes
    ) order by treatment_add_on.display_order, treatment_add_on.name), '[]'::jsonb),
    count(*)::integer,
    selected_treatment.duration_minutes + coalesce(sum(treatment_add_on.additional_duration_minutes), 0)::integer,
    selected_treatment.price_pence + coalesce(sum(treatment_add_on.additional_price_pence), 0)::bigint
  into selected_add_ons, selected_add_on_count, total_duration_minutes, total_price_pence
  from ceaute.treatment_add_on
  join ceaute.treatment_add_on_compatibility
    on treatment_add_on_compatibility.treatment_add_on_id = treatment_add_on.id
    and treatment_add_on_compatibility.provider_page_id = treatment_add_on.provider_page_id
  where treatment_add_on.provider_page_id = target_provider_page_id
    and treatment_add_on.is_active = true
    and treatment_add_on.id = any(unique_add_on_ids)
    and treatment_add_on_compatibility.treatment_id = target_treatment_id;

  if selected_add_on_count <> cardinality(unique_add_on_ids) then
    raise exception 'Selected add-ons are not available.';
  end if;

  requested_end_at := requested_start_at + make_interval(mins => total_duration_minutes);
  requested_local_start := requested_start_at at time zone 'Europe/London';
  requested_local_end := requested_end_at at time zone 'Europe/London';

  if requested_start_at <> date_trunc('minute', requested_start_at)
    or extract(minute from requested_local_start)::integer % 15 <> 0
    or requested_start_at < now() + interval '24 hours'
    or requested_local_start::date < current_local_date
    or requested_local_start::date > current_local_date + 60
    or requested_local_end::date <> requested_local_start::date then
    raise exception 'Requested time is outside the booking rules.';
  end if;

  select * into availability_rule
  from ceaute.availability_rule
  where provider_page_id = target_provider_page_id
    and weekday = extract(dow from requested_local_start)::integer
  for share;

  if availability_rule.id is null
    or requested_local_start::time < availability_rule.starts_at
    or requested_local_end::time > availability_rule.ends_at then
    raise exception 'Requested time is unavailable.';
  end if;

  if exists (
    select 1
    from ceaute.blocked_date
    where provider_page_id = target_provider_page_id
      and local_date = requested_local_start::date
  ) then
    raise exception 'Requested date is blocked.';
  end if;

  -- The share lock already taken on provider_page above is what keeps a
  -- provider from moving away between this read and the hold being inserted:
  -- ceaute.set_primary_provider_location must take that same row for update
  -- before it touches any location. Locking the location row here as well
  -- would be worse than useless — a concurrent move clears is_primary, and a
  -- row lock whose qualification stops holding is skipped, which would leave
  -- the hold with no location at all.
  select * into location
  from ceaute.provider_location
  where provider_page_id = target_provider_page_id
    and is_primary = true;

  -- Publication and ceaute.set_primary_provider_location both refuse to leave a
  -- published page working from a location like this, so reaching here means
  -- something upstream has been bypassed. Refusing the hold is better than
  -- selling an appointment with no address in its snapshot, which nothing
  -- downstream could ever repair.
  if location.id is null
    or not ceaute.provider_location_is_complete(
      location.is_active,
      location.public_area,
      location.address_line_1,
      location.city,
      location.postcode
    ) then
    raise exception 'Provider location is unavailable.';
  end if;

  select * into booking_setting
  from ceaute.provider_booking_setting
  where provider_page_id = target_provider_page_id;

  insert into ceaute.booking (
    customer_profile_id,
    provider_page_id,
    treatment_id,
    provider_location_id,
    start_at,
    end_at,
    status,
    expires_at,
    customer_snapshot,
    service_snapshot
  ) values (
    target_customer_profile_id,
    target_provider_page_id,
    target_treatment_id,
    location.id,
    requested_start_at,
    requested_end_at,
    'awaiting_payment',
    now() + interval '5 minutes',
    jsonb_build_object(
      'full_name', customer_profile.full_name,
      'email', customer_email,
      'phone', customer_profile.phone_e164
    ),
    jsonb_build_object(
      'provider_display_name', provider_page.display_name,
      'provider_username', provider_page.username,
      'treatment_name', selected_treatment.name,
      'treatment_description', selected_treatment.description,
      'selected_add_ons', selected_add_ons,
      'start_at', requested_start_at,
      'end_at', requested_end_at,
      'duration_minutes', total_duration_minutes,
      'public_area', location.public_area,
      'address_line_1', location.address_line_1,
      'address_line_2', location.address_line_2,
      'city', location.city,
      'postcode', location.postcode,
      'access_instructions', location.access_instructions,
      'total_price_pence', total_price_pence,
      'payment_mode', coalesce(booking_setting.payment_mode, 'full'),
      'commitment_amount_pence', booking_setting.commitment_amount_pence,
      'cancellation_window_hours', coalesce(booking_setting.cancellation_window_hours, 24),
      'written_policy', booking_setting.written_policy
    )
  )
  returning id into hold_id;

  return hold_id;
end;
$$;

revoke all on function ceaute.create_validated_booking_hold(uuid, uuid, uuid, uuid[], timestamptz)
from public, anon, authenticated, service_role;

grant execute on function ceaute.create_validated_booking_hold(uuid, uuid, uuid, uuid[], timestamptz)
to service_role;
