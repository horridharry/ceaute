-- The public provider projections accepted any page whose status was not
-- 'suspended', so a draft page was readable by anyone who knew its ID. The web
-- loader resolves a published page first, but that ordering is application
-- behaviour: these are security-definer functions granted to anon and
-- authenticated, so a direct RPC call bypasses it entirely.
--
-- Publication is the public visibility rule, so require it here. Each function
-- below is its latest effective definition with only the status predicate
-- changed; get_public_occupied_periods keeps the hold-expiry condition added in
-- 202609110013 rather than the original 202609110011 body.
--
-- This does not touch how a provider reads their own page: the dashboard, its
-- storefront preview, and onboarding use the signed-in provider's client
-- against the underlying tables, where RLS already scopes rows to the owner.
-- Draft and suspended pages return no rows here rather than raising, which
-- keeps the existing public API shape.

create or replace function ceaute.get_public_availability_rules(
  target_provider_page_id uuid
)
returns table (
  weekday smallint,
  starts_at time,
  ends_at time
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select
    availability_rule.weekday,
    availability_rule.starts_at,
    availability_rule.ends_at
  from ceaute.availability_rule
  join ceaute.provider_page
    on provider_page.id = availability_rule.provider_page_id
  where availability_rule.provider_page_id = target_provider_page_id
    and provider_page.status = 'published'
  order by availability_rule.weekday;
$$;

create or replace function ceaute.get_public_blocked_dates(
  target_provider_page_id uuid
)
returns table (
  local_date date
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select blocked_date.local_date
  from ceaute.blocked_date
  join ceaute.provider_page
    on provider_page.id = blocked_date.provider_page_id
  where blocked_date.provider_page_id = target_provider_page_id
    and provider_page.status = 'published'
  order by blocked_date.local_date;
$$;

create or replace function ceaute.get_public_occupied_periods(
  target_provider_page_id uuid
)
returns table (
  start_at timestamptz,
  end_at timestamptz
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select booking.start_at, booking.end_at
  from ceaute.booking
  join ceaute.provider_page
    on provider_page.id = booking.provider_page_id
  where booking.provider_page_id = target_provider_page_id
    and (
      booking.status = 'confirmed'
      or (
        booking.status = 'awaiting_payment'
        and booking.expires_at > now()
      )
    )
    and booking.end_at > now()
    and provider_page.status = 'published'
  order by booking.start_at;
$$;

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
    and provider_page.status = 'published'
  limit 1;
$$;

create or replace function ceaute.get_public_booking_settings(
  target_provider_page_id uuid
)
returns table (
  payment_mode text,
  commitment_amount_pence bigint,
  cancellation_window_hours smallint,
  written_policy text
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select
    provider_booking_setting.payment_mode,
    provider_booking_setting.commitment_amount_pence,
    provider_booking_setting.cancellation_window_hours,
    provider_booking_setting.written_policy
  from ceaute.provider_booking_setting
  join ceaute.provider_page
    on provider_page.id = provider_booking_setting.provider_page_id
  where provider_booking_setting.provider_page_id = target_provider_page_id
    and provider_page.status = 'published'
  limit 1;
$$;

comment on function ceaute.get_public_availability_rules(uuid) is
  'Public projection: returns rows only for a published provider page.';
comment on function ceaute.get_public_blocked_dates(uuid) is
  'Public projection: returns rows only for a published provider page.';
comment on function ceaute.get_public_occupied_periods(uuid) is
  'Public projection: returns rows only for a published provider page.';
comment on function ceaute.get_public_provider_location(uuid) is
  'Public projection: returns the public area only for a published provider page.';
comment on function ceaute.get_public_booking_settings(uuid) is
  'Public projection: returns booking terms only for a published provider page.';
