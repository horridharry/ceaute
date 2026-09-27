-- Flat deposits, beside percentage deposits and full payment.
--
-- Approved 27 September 2026 (docs/decisions/008-flat-deposit.md):
--   * a Deposit is either a flat amount or a percentage (decision 006);
--   * a flat deposit is a whole number of pounds, at least £1, one amount for
--     the whole business whatever the Treatment or Add-ons, with no maximum;
--   * what is paid now is the flat amount, never more than the booking price:
--     a booking that costs less than the flat deposit is paid in full now;
--   * a late customer cancellation keeps all of what was paid now, so never
--     more than was paid; an early or provider cancellation refunds it all;
--   * percentage deposits and full payment are unchanged, and settings saved
--     before decision 006 stay exactly as saved and incomplete.
--
-- The hold snapshot gains deposit_kind ('flat' | 'percentage', null for full
-- payment) and deposit_amount_pence. Nothing here reads or rewrites an existing
-- booking snapshot: bookings keep the terms they were made on, and readers
-- accept snapshots without deposit_kind.

-- Booking settings ------------------------------------------------------------

alter table ceaute.provider_booking_setting
  add column deposit_amount_pence integer;

comment on column ceaute.provider_booking_setting.deposit_amount_pence is
  'Flat deposit in pence, a whole number of pounds of at least £1. Set only for a flat deposit; null for a percentage deposit and for full payment.';

-- The one definition of "complete booking terms", now with a flat deposit.
-- Exactly one of the percentage and the flat amount is set: a percentage for
-- full payment (10-100%) or a percentage deposit (10-90%), in 5% steps, or a
-- flat deposit of whole pounds, at least £1, with no upper limit.
create function ceaute.booking_terms_are_complete(
  target_payment_mode text,
  target_deposit_percent integer,
  target_deposit_amount_pence integer,
  target_cancellation_window_hours integer
)
returns boolean
language sql
immutable
set search_path = ceaute, public
as $$
  select coalesce(
    target_cancellation_window_hours in (12, 24, 48)
    and (
      (target_payment_mode = 'full'
        and target_deposit_amount_pence is null
        and target_deposit_percent % 5 = 0
        and target_deposit_percent between 10 and 100)
      or (target_payment_mode = 'deposit'
        and target_deposit_amount_pence is null
        and target_deposit_percent % 5 = 0
        and target_deposit_percent between 10 and 90)
      or (target_payment_mode = 'deposit'
        and target_deposit_percent is null
        and target_deposit_amount_pence >= 100
        and target_deposit_amount_pence % 100 = 0)
    ),
    false
  );
$$;

-- Same name, now accepting a flat deposit. NOT VALID keeps the rows saved
-- before decision 006 exactly as saved and incomplete until their owner saves
-- again (see provider_page_publication_check_values); every new insert or
-- update must save complete terms.
alter table ceaute.provider_booking_setting
  drop constraint provider_booking_setting_percentage_terms;

alter table ceaute.provider_booking_setting
  add constraint provider_booking_setting_percentage_terms check (
    ceaute.booking_terms_are_complete(
      payment_mode, deposit_percent, deposit_amount_pence, cancellation_window_hours
    )
    and commitment_amount_pence is null
  ) not valid;

comment on constraint provider_booking_setting_percentage_terms
on ceaute.provider_booking_setting is
  'Complete booking terms (flat or percentage deposit, or full payment) for every new write. NOT VALID keeps pre-006 rows exactly as saved and incomplete.';

-- The money rule --------------------------------------------------------------

-- The only implementation of the rule. Every operand is a non-negative whole
-- number of pence, so integer division is the floor and the result is exact.
-- A flat deposit is paid now up to the whole price, and a late cancellation
-- keeps all of it. The percentage body is unchanged from 202609230001.
create function ceaute.booking_payment_terms(
  target_total_price_pence bigint,
  target_payment_mode text,
  target_deposit_percent integer,
  target_deposit_amount_pence integer
)
returns table (
  amount_due_now_pence bigint,
  amount_due_later_pence bigint,
  late_cancellation_retained_pence bigint
)
language plpgsql
immutable
set search_path = ceaute, public
as $$
declare
  percentage_amount bigint;
  due_now bigint;
begin
  if target_total_price_pence is null
    or target_total_price_pence < 0
    or not ceaute.booking_terms_are_complete(
      target_payment_mode, target_deposit_percent, target_deposit_amount_pence, 24
    ) then
    raise exception 'Invalid booking payment terms.';
  end if;

  if target_payment_mode = 'deposit' and target_deposit_amount_pence is not null then
    -- Never more than the whole price; a late cancellation keeps all of it.
    due_now := least(target_total_price_pence, target_deposit_amount_pence);

    return query select
      due_now,
      target_total_price_pence - due_now,
      due_now;
    return;
  end if;

  -- Nearest penny, half up.
  percentage_amount := (target_total_price_pence * target_deposit_percent + 50) / 100;

  if target_payment_mode = 'deposit' then
    -- £1 minimum online payment, never more than the whole price.
    due_now := least(target_total_price_pence, greatest(percentage_amount, 100));
  else
    due_now := target_total_price_pence;
  end if;

  return query select
    due_now,
    target_total_price_pence - due_now,
    least(percentage_amount, due_now);
end;
$$;

-- Publication requirements ----------------------------------------------------

-- Redefined from 202609270001 with only the booking-terms value changed: it
-- passes the flat deposit amount to the 4-argument completeness check.

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
          provider_booking_setting.deposit_amount_pence,
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

-- The customer's quote -------------------------------------------------------------

-- Dropped and recreated because the return table gains deposit_kind and
-- deposit_amount_pence. Otherwise the 202609230001 body, on the 4-argument
-- completeness and money functions.
drop function ceaute.get_public_booking_terms(uuid, bigint);

-- What Review shows before any hold exists, from the same rule the hold uses.
-- Public projection: nothing for a page that is not published.
create function ceaute.get_public_booking_terms(
  target_provider_page_id uuid,
  target_total_price_pence bigint
)
returns table (
  payment_mode text,
  deposit_percent smallint,
  deposit_kind text,
  deposit_amount_pence integer,
  cancellation_window_hours smallint,
  written_policy text,
  accepts_new_bookings boolean,
  amount_due_now_pence bigint,
  amount_due_later_pence bigint,
  late_cancellation_retained_pence bigint
)
language plpgsql
stable
security definer
set search_path = ceaute, public
as $$
declare
  setting ceaute.provider_booking_setting%rowtype;
  accepts boolean;
  kind text;
  terms record;
begin
  if not exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and provider_page.status = 'published'
  ) then
    return;
  end if;

  select * into setting
  from ceaute.provider_booking_setting
  where provider_booking_setting.provider_page_id = target_provider_page_id;

  accepts := ceaute.provider_page_accepts_new_bookings(target_provider_page_id);

  kind := case when setting.payment_mode = 'deposit' then
    case when setting.deposit_amount_pence is not null then 'flat' else 'percentage' end
  end;

  if not accepts
    or not ceaute.booking_terms_are_complete(
      setting.payment_mode, setting.deposit_percent,
      setting.deposit_amount_pence, setting.cancellation_window_hours
    )
    or target_total_price_pence is null
    or target_total_price_pence < 100 then
    return query select
      setting.payment_mode, setting.deposit_percent,
      kind, setting.deposit_amount_pence,
      setting.cancellation_window_hours, setting.written_policy,
      false, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  select * into terms
  from ceaute.booking_payment_terms(
    target_total_price_pence, setting.payment_mode,
    setting.deposit_percent, setting.deposit_amount_pence
  );

  return query select
    setting.payment_mode, setting.deposit_percent,
    kind, setting.deposit_amount_pence,
    setting.cancellation_window_hours, setting.written_policy,
    true,
    terms.amount_due_now_pence,
    terms.amount_due_later_pence,
    terms.late_cancellation_retained_pence;
end;
$$;

revoke all on function ceaute.get_public_booking_terms(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function ceaute.get_public_booking_terms(uuid, bigint)
to authenticated, service_role;

comment on function ceaute.get_public_booking_terms(uuid, bigint) is
  'Public projection: booking terms and the amounts for a price, only for a published provider page.';

-- The hold check --------------------------------------------------------------

-- Redefined from 202609270001 with only two changes: the money rule receives
-- the flat deposit amount, and the service snapshot records deposit_kind
-- ('flat' | 'percentage', null for full payment) and deposit_amount_pence.

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
    booking_setting.deposit_percent,
    booking_setting.deposit_amount_pence
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
      'deposit_kind', case when booking_setting.payment_mode = 'deposit' then
        case when booking_setting.deposit_amount_pence is not null then 'flat' else 'percentage' end
      end,
      'deposit_amount_pence', booking_setting.deposit_amount_pence,
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

-- Retire the 3-argument versions ------------------------------------------------

-- Every caller (the table check, the publication checks, the public quote and
-- the hold) now uses the 4-argument versions above.
drop function ceaute.booking_payment_terms(bigint, text, integer);
drop function ceaute.booking_terms_are_complete(text, integer, integer);

revoke all on function ceaute.booking_terms_are_complete(text, integer, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function ceaute.booking_payment_terms(bigint, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.booking_terms_are_complete(text, integer, integer, integer)
to authenticated, service_role;
grant execute on function ceaute.booking_payment_terms(bigint, text, integer, integer)
to authenticated, service_role;

-- Comments --------------------------------------------------------------------

comment on column ceaute.provider_booking_setting.deposit_percent is
  'Percentage deposit or full-payment percentage; null for a flat deposit';

comment on function ceaute.provider_page_accepts_new_bookings(uuid) is
  'Published, complete booking terms, Stripe ready, current agreement accepted and no outstanding balance.';
