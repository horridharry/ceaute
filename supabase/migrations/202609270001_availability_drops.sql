-- Availability is set per date and released in drops.
--
-- Approved 27 September 2026 (docs/decisions/007-availability-released-in-drops.md):
--   * ceaute.availability_drop: a group of dates with one drop time (opens_at).
--     A drop is private until its drop time; nothing runs at that moment, the
--     drop time is compared with the clock on every read and every hold;
--   * ceaute.availability_date: one row per local date, in exactly one drop,
--     with either hours (one opening and one closing time) or a list of start
--     times, never both. Times sit on the quarter hour, no later than 23:45;
--   * both tables are read by their owner through RLS and written only through
--     ceaute.save_availability_drop, which saves one drop's dates, times and
--     drop time together;
--   * ceaute.get_public_open_dates returns only the dates of opened drops on a
--     published page, and ceaute.get_public_availability_summary returns the
--     open drops and the next drop time, each described only as far as its
--     name shows, so an unopened drop's dates stay hidden in PostgreSQL itself;
--   * ceaute.create_validated_booking_hold accepts a start only on a date of
--     an opened drop, inside its hours or at one of its start times. The
--     weekday, blocked-date and 60-day rules are gone; 24 hours' notice, the
--     15-minute grid and same-day end are unchanged;
--   * the publication requirement has_working_hours now means at least one
--     date from today on with times, opened or not;
--   * the weekly model is removed: replace_provider_availability_rules,
--     get_public_availability_rules, get_public_blocked_dates, blocked_date
--     and availability_rule. Existing weekly hours and blocked dates are
--     deleted, not converted. Bookings are untouched.

-- Helpers ---------------------------------------------------------------------

create function ceaute.is_quarter_hour_time(t time)
returns boolean
language sql
immutable
set search_path = ceaute, public
as $$
  select t is null
    or (extract(second from t) = 0 and extract(minute from t)::integer % 15 = 0);
$$;

-- A date's start times: 1 to 96 quarter-hour times, no later than 23:45, no
-- nulls, strictly ascending (so no duplicates).
create function ceaute.start_times_are_valid(times time[])
returns boolean
language sql
immutable
set search_path = ceaute, public
as $$
  select coalesce(
    array_ndims(times) = 1
      and cardinality(times) between 1 and 96
      and not exists (
        select 1
        from (
          select
            element.value,
            lag(element.value) over (order by element.position) as previous_value
          from unnest(times) with ordinality as element(value, position)
        ) as ordered
        where ordered.value is null
          or not ceaute.is_quarter_hour_time(ordered.value)
          or ordered.value > time '23:45'
          or ordered.value <= ordered.previous_value
      ),
    false
  );
$$;

revoke all on function ceaute.is_quarter_hour_time(time)
from public, anon, authenticated;
revoke all on function ceaute.start_times_are_valid(time[])
from public, anon, authenticated;

-- Drops -----------------------------------------------------------------------

create table ceaute.availability_drop (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page(id) on delete cascade,
  opens_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_drop_id_provider_page_id_key unique (id, provider_page_id)
);

create index availability_drop_provider_page_id_idx
  on ceaute.availability_drop (provider_page_id);

create trigger availability_drop_set_updated_at
before update on ceaute.availability_drop
for each row
execute function ceaute.set_updated_at();

comment on table ceaute.availability_drop is
  'A group of dates released together at opens_at (the drop time). Private until then (decision 007).';

-- Dates -----------------------------------------------------------------------

create table ceaute.availability_date (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null,
  drop_id uuid not null,
  local_date date not null,
  hours_start time,
  hours_end time,
  start_times time[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint availability_date_drop_fkey
    foreign key (drop_id, provider_page_id)
    references ceaute.availability_drop (id, provider_page_id)
    on delete cascade,
  constraint availability_date_provider_page_id_local_date_key
    unique (provider_page_id, local_date),
  constraint availability_date_hours_or_start_times check (
    (hours_start is not null and hours_end is not null and start_times is null)
    or (hours_start is null and hours_end is null and start_times is not null)
  ),
  constraint availability_date_hours_order check (hours_end > hours_start),
  constraint availability_date_hours_quarter_hour check (
    ceaute.is_quarter_hour_time(hours_start)
    and ceaute.is_quarter_hour_time(hours_end)
    and (hours_end is null or hours_end <= time '23:45')
  ),
  constraint availability_date_start_times_valid check (
    start_times is null or ceaute.start_times_are_valid(start_times)
  )
);

create index availability_date_drop_id_idx
  on ceaute.availability_date (drop_id);

create trigger availability_date_set_updated_at
before update on ceaute.availability_date
for each row
execute function ceaute.set_updated_at();

comment on table ceaute.availability_date is
  'One Europe/London date a provider opens, in exactly one drop, with hours or start times (decision 007).';

-- RLS and grants --------------------------------------------------------------

-- Owners read their own rows; nobody writes directly. Every write goes through
-- ceaute.save_availability_drop.
alter table ceaute.availability_drop enable row level security;
alter table ceaute.availability_date enable row level security;

revoke all on ceaute.availability_drop from anon, authenticated;
revoke all on ceaute.availability_date from anon, authenticated;

grant select on ceaute.availability_drop to authenticated;
grant select on ceaute.availability_date to authenticated;

create policy availability_drop_select_own_provider
on ceaute.availability_drop
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_drop.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy availability_date_select_own_provider
on ceaute.availability_date
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_date.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

grant select on ceaute.availability_drop to service_role;
grant select on ceaute.availability_date to service_role;

-- Saving a drop ---------------------------------------------------------------

-- Saves one drop's dates, times and drop time together. target_drop_id null
-- creates a drop; opens_on and opens_time both null mean Now. drop_dates is
-- the drop's full list of dates from today on: [{"local_date", "hours_start",
-- "hours_end", "start_times"}]. Its past dates are left as they are. Returns
-- the drop's id, or null when the drop has no date from today on (it is then
-- deleted, or never created). Check violations raise SQLSTATE 23514.
create function ceaute.save_availability_drop(
  target_provider_page_id uuid,
  target_drop_id uuid,
  opens_on date,
  opens_time time,
  drop_dates jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  today date;
  new_opens_at timestamptz;
  saved_drop_id uuid;
  parsed_count integer;
  saved_count integer;
begin
  if not exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and provider_page.owner_profile_id = auth.uid()
  ) then
    raise exception 'Provider page not found.';
  end if;

  today := (now() at time zone 'Europe/London')::date;

  if drop_dates is null or jsonb_typeof(drop_dates) <> 'array' then
    raise exception 'Dates must be a list.';
  end if;

  if opens_on is null and opens_time is null then
    new_opens_at := now();
  elsif opens_on is null or opens_time is null then
    raise exception 'Drop time is incomplete.';
  else
    if not ceaute.is_quarter_hour_time(opens_time) then
      raise exception 'Drop time must be on the quarter hour.';
    end if;

    new_opens_at := (opens_on + opens_time) at time zone 'Europe/London';

    if new_opens_at <= now() then
      raise exception 'Drop time has passed.';
    end if;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(drop_dates) as parsed(local_date date)
    where parsed.local_date is null
      or parsed.local_date < today
  ) then
    raise exception 'Choose dates from today on.';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(drop_dates) as parsed(local_date date)
    group by parsed.local_date
    having count(*) > 1
  ) then
    raise exception 'Each date can only be saved once.';
  end if;

  parsed_count := jsonb_array_length(drop_dates);

  if target_drop_id is null then
    if parsed_count = 0 then
      return null;
    end if;

    insert into ceaute.availability_drop (provider_page_id, opens_at)
    values (target_provider_page_id, new_opens_at)
    returning id into saved_drop_id;
  else
    select availability_drop.id into saved_drop_id
    from ceaute.availability_drop
    where availability_drop.id = target_drop_id
      and availability_drop.provider_page_id = target_provider_page_id
    for update;

    if saved_drop_id is null then
      raise exception 'Drop not found.';
    end if;

    update ceaute.availability_drop
    set opens_at = new_opens_at
    where availability_drop.id = saved_drop_id;
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(drop_dates) as parsed(local_date date)
    join ceaute.availability_date
      on availability_date.provider_page_id = target_provider_page_id
      and availability_date.local_date = parsed.local_date
    where availability_date.drop_id <> saved_drop_id
  ) then
    raise exception 'Date is in another drop.';
  end if;

  delete from ceaute.availability_date
  where availability_date.drop_id = saved_drop_id
    and availability_date.local_date >= today
    and not exists (
      select 1
      from jsonb_to_recordset(drop_dates) as parsed(local_date date)
      where parsed.local_date = availability_date.local_date
    );

  -- The WHERE on the update keeps a date that another save has just put in a
  -- different drop where it is; the row count below then refuses this save.
  insert into ceaute.availability_date (
    provider_page_id,
    drop_id,
    local_date,
    hours_start,
    hours_end,
    start_times
  )
  select
    target_provider_page_id,
    saved_drop_id,
    parsed.local_date,
    parsed.hours_start,
    parsed.hours_end,
    parsed.start_times
  from jsonb_to_recordset(drop_dates) as parsed(
    local_date date,
    hours_start time,
    hours_end time,
    start_times time[]
  )
  on conflict (provider_page_id, local_date) do update
  set hours_start = excluded.hours_start,
      hours_end = excluded.hours_end,
      start_times = excluded.start_times
  where availability_date.drop_id = excluded.drop_id;

  get diagnostics saved_count = row_count;

  if saved_count <> parsed_count then
    raise exception 'Date is in another drop.';
  end if;

  if not exists (
    select 1
    from ceaute.availability_date
    where availability_date.drop_id = saved_drop_id
      and availability_date.local_date >= today
  ) then
    delete from ceaute.availability_drop
    where availability_drop.id = saved_drop_id;

    return null;
  end if;

  return saved_drop_id;
end;
$$;

revoke all on function ceaute.save_availability_drop(uuid, uuid, date, time, jsonb)
from public, anon, authenticated, service_role;
grant execute on function ceaute.save_availability_drop(uuid, uuid, date, time, jsonb)
to authenticated;

-- Public projections ----------------------------------------------------------

create function ceaute.get_public_open_dates(
  target_provider_page_id uuid
)
returns table (
  local_date date,
  hours_start time,
  hours_end time,
  start_times time[]
)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select
    availability_date.local_date,
    availability_date.hours_start,
    availability_date.hours_end,
    availability_date.start_times
  from ceaute.availability_date
  join ceaute.availability_drop
    on availability_drop.id = availability_date.drop_id
  join ceaute.provider_page
    on provider_page.id = availability_date.provider_page_id
  where availability_date.provider_page_id = target_provider_page_id
    and provider_page.status = 'published'
    and availability_drop.opens_at <= now()
    and availability_date.local_date >= (now() at time zone 'Europe/London')::date
  order by availability_date.local_date;
$$;

comment on function ceaute.get_public_open_dates(uuid) is
  'Public projection: only dates of opened drops on a published page.';

-- Each chosen drop is described only by its name: by month ('November') when
-- all its current dates are in one month and no other current drop has dates
-- in that month, otherwise by its first and last dates ('1-14 November'). The
-- sharing test counts every current drop, opened or not, as the provider
-- screen does. Months are taken on plain dates, so the session time zone does
-- not matter.
create function ceaute.get_public_availability_summary(
  target_provider_page_id uuid
)
returns table (
  drop_month date,
  first_date date,
  last_date date,
  opens_at timestamptz,
  is_open boolean
)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  with visible_page as (
    select provider_page.id
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and (
        provider_page.status = 'published'
        or provider_page.owner_profile_id = (select auth.uid())
      )
  ),
  current_dates as (
    select
      availability_date.drop_id,
      availability_date.local_date
    from ceaute.availability_date
    join visible_page
      on visible_page.id = availability_date.provider_page_id
    where availability_date.local_date >= (now() at time zone 'Europe/London')::date
  ),
  current_drops as (
    select
      availability_drop.id as drop_id,
      availability_drop.opens_at as drop_opens_at,
      min(current_dates.local_date) as min_date,
      max(current_dates.local_date) as max_date
    from current_dates
    join ceaute.availability_drop
      on availability_drop.id = current_dates.drop_id
    group by availability_drop.id, availability_drop.opens_at
  ),
  named as (
    select
      current_drops.drop_id,
      current_drops.drop_opens_at,
      current_drops.min_date,
      current_drops.max_date,
      date_trunc('month', current_drops.min_date::timestamp)
          = date_trunc('month', current_drops.max_date::timestamp)
        and not exists (
          select 1
          from current_dates as other_dates
          where other_dates.drop_id <> current_drops.drop_id
            and date_trunc('month', other_dates.local_date::timestamp)
              = date_trunc('month', current_drops.min_date::timestamp)
        ) as named_by_month
    from current_drops
  ),
  chosen as (
    select named.*
    from named
    where named.drop_opens_at <= now()
    union all
    (
      select named.*
      from named
      where named.drop_opens_at > now()
      order by named.drop_opens_at, named.min_date, named.drop_id
      limit 1
    )
  )
  select
    case when chosen.named_by_month
      then date_trunc('month', chosen.min_date::timestamp)::date
    end as drop_month,
    case when not chosen.named_by_month then chosen.min_date end as first_date,
    case when not chosen.named_by_month then chosen.max_date end as last_date,
    case when chosen.drop_opens_at > now() then chosen.drop_opens_at end as opens_at,
    chosen.drop_opens_at <= now() as is_open
  from chosen
  order by chosen.drop_opens_at > now(), chosen.min_date;
$$;

comment on function ceaute.get_public_availability_summary(uuid) is
  'Public projection: open drops and the next drop time. Returns only what each drop name shows (decision 007: unopened dates stay hidden).';

revoke all on function ceaute.get_public_open_dates(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_public_availability_summary(uuid)
from public, anon, authenticated;

grant execute on function ceaute.get_public_open_dates(uuid)
to anon, authenticated, service_role;
grant execute on function ceaute.get_public_availability_summary(uuid)
to anon, authenticated, service_role;

-- The hold check --------------------------------------------------------------

-- Redefined from 202609230002 with only the availability check changed: a
-- start is accepted only on a date of an opened drop, inside its hours or at
-- one of its start times. The 60-day window and the weekday and blocked-date
-- rules are gone. Only the date row is share-locked, as the weekday row was:
-- save_availability_drop locks the drop first, so locking it here too could
-- deadlock, and decision 007 lets a hold made just before a drop is hidden
-- again stand. Both exception texts are matched by the booking action.

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
  open_date record;
  unique_add_on_ids uuid[];
  selected_add_ons jsonb;
  selected_add_on_count integer;
  total_duration_minutes integer;
  total_price_pence bigint;
  payment_terms record;
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

  -- Checked with the page row share-locked, so an owner cannot unpublish in
  -- between. Terms, agreement and Stripe state are read at this instant; a
  -- hold made now keeps the terms it snapshots.
  if not ceaute.provider_page_accepts_new_bookings(target_provider_page_id) then
    raise exception 'Provider is not taking bookings.';
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

  -- The minimum online payment. Treatments saved since 202609230001 cost at
  -- least £1 already; this keeps an older cheaper one from reaching Checkout.
  if total_price_pence < 100 then
    raise exception 'Treatment not available.';
  end if;

  requested_end_at := requested_start_at + make_interval(mins => total_duration_minutes);
  requested_local_start := requested_start_at at time zone 'Europe/London';
  requested_local_end := requested_end_at at time zone 'Europe/London';

  if requested_start_at <> date_trunc('minute', requested_start_at)
    or extract(minute from requested_local_start)::integer % 15 <> 0
    or requested_start_at < now() + interval '24 hours'
    or requested_local_start::date < current_local_date
    or requested_local_end::date <> requested_local_start::date then
    raise exception 'Requested time is outside the booking rules.';
  end if;

  select
    availability_date.hours_start,
    availability_date.hours_end,
    availability_date.start_times
  into open_date
  from ceaute.availability_date
  join ceaute.availability_drop
    on availability_drop.id = availability_date.drop_id
  where availability_date.provider_page_id = target_provider_page_id
    and availability_date.local_date = requested_local_start::date
    and availability_drop.opens_at <= now()
  for share of availability_date;

  if not found then
    raise exception 'Requested time is unavailable.';
  end if;

  if open_date.start_times is null
    and (requested_local_start::time < open_date.hours_start
      or requested_local_end::time > open_date.hours_end) then
    raise exception 'Requested time is unavailable.';
  end if;

  if open_date.start_times is not null
    and not (requested_local_start::time = any(open_date.start_times)) then
    raise exception 'Requested time is unavailable.';
  end if;

  -- The share lock already taken on provider_page above is what keeps a
  -- provider from moving away between this read and the hold being inserted
  -- (see 202609200001).
  select * into location
  from ceaute.provider_location
  where provider_page_id = target_provider_page_id
    and is_primary = true;

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

  -- Complete terms are guaranteed by provider_page_accepts_new_bookings above.
  select * into payment_terms
  from ceaute.booking_payment_terms(
    total_price_pence,
    booking_setting.payment_mode,
    booking_setting.deposit_percent
  );

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
    now() + interval '10 minutes',
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
      'payment_mode', booking_setting.payment_mode,
      'deposit_percent', booking_setting.deposit_percent,
      'amount_due_now_pence', payment_terms.amount_due_now_pence,
      'commitment_amount_pence', payment_terms.late_cancellation_retained_pence,
      'cancellation_window_hours', booking_setting.cancellation_window_hours,
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

-- Publication requirements ----------------------------------------------------

-- Redefined from 202609230001 with only the fifth value changed.
-- has_working_hours keeps its name but now means 'at least one date from today
-- on with times, opened or not' (decision 007).

create or replace function ceaute.provider_page_publication_check_values(
  target_provider_page_id uuid
)
returns table (
  has_business_profile boolean,
  has_bookable_treatment boolean,
  has_visible_photo boolean,
  has_current_location boolean,
  has_working_hours boolean,
  has_booking_terms boolean,
  payments_ready boolean,
  agreement_accepted boolean
)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select
    nullif(btrim(provider_page.display_name), '') is not null
      and nullif(btrim(provider_page.username), '') is not null
      and nullif(btrim(provider_page.provider_category), '') is not null,
    exists (
      select 1
      from ceaute.treatment
      where treatment.provider_page_id = provider_page.id
        and treatment.is_active = true
        and treatment.discovery_category_id is not null
        and treatment.price_pence >= 100
        and treatment.duration_minutes > 0
    ),
    exists (
      select 1
      from ceaute.portfolio_image
      where portfolio_image.provider_page_id = provider_page.id
        and portfolio_image.is_visible = true
    ),
    exists (
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
    ),
    exists (
      select 1
      from ceaute.availability_date
      where availability_date.provider_page_id = provider_page.id
        and availability_date.local_date >= (now() at time zone 'Europe/London')::date
    ),
    exists (
      select 1
      from ceaute.provider_booking_setting
      where provider_booking_setting.provider_page_id = provider_page.id
        and ceaute.booking_terms_are_complete(
          provider_booking_setting.payment_mode,
          provider_booking_setting.deposit_percent,
          provider_booking_setting.cancellation_window_hours
        )
    ),
    exists (
      select 1
      from ceaute.provider_payment_account
      where provider_payment_account.provider_page_id = provider_page.id
        and provider_payment_account.recipient_applied = true
        and provider_payment_account.stripe_transfers_status = 'active'
        and provider_payment_account.payouts_status = 'active'
    ),
    exists (
      select 1
      from ceaute.provider_agreement_acceptance
      where provider_agreement_acceptance.provider_page_id = provider_page.id
        and provider_agreement_acceptance.agreement_version
          = ceaute.current_provider_agreement_version()
    )
  from ceaute.provider_page
  where provider_page.id = target_provider_page_id;
$$;

-- The weekly model ------------------------------------------------------------

-- Deletes existing weekly hours and blocked dates without converting them.
-- No cascade: nothing else may still depend on these.
drop function ceaute.replace_provider_availability_rules(uuid, jsonb);
drop function ceaute.get_public_availability_rules(uuid);
drop function ceaute.get_public_blocked_dates(uuid);
drop table ceaute.blocked_date;
drop table ceaute.availability_rule;

comment on column ceaute.provider_page.booking_window_days is
  'Unused. There is no booking window since decision 007.';
