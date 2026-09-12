create table ceaute.booking_payment_attempt (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references ceaute.booking (id) on delete restrict,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  amount_charged_pence bigint not null check (amount_charged_pence >= 0),
  total_booking_value_pence bigint not null check (total_booking_value_pence >= 0),
  amount_due_later_pence bigint not null check (amount_due_later_pence >= 0),
  ceaute_fee_pence bigint not null default 0 check (ceaute_fee_pence >= 0),
  currency text not null default 'gbp' check (currency = 'gbp'),
  payment_status text not null default 'created' check (
    payment_status in (
      'created',
      'checkout_created',
      'succeeded',
      'failed',
      'cancelled',
      'refund_required',
      'refunded',
      'refund_failed'
    )
  ),
  provider_stripe_account_id text not null,
  failure_reason text,
  stripe_refund_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id)
);

create trigger booking_payment_attempt_set_updated_at
before update on ceaute.booking_payment_attempt
for each row execute function ceaute.set_updated_at();

alter table ceaute.booking_payment_attempt enable row level security;

revoke all on ceaute.booking_payment_attempt from anon, authenticated;

create table ceaute.stripe_payment_event (
  id text primary key,
  type text not null,
  booking_payment_attempt_id uuid references ceaute.booking_payment_attempt (id) on delete set null,
  stripe_payment_intent_id text,
  processed_at timestamptz not null default now()
);

alter table ceaute.stripe_payment_event enable row level security;

revoke all on ceaute.stripe_payment_event from anon, authenticated;

create or replace function ceaute.create_booking_hold(
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
  current_profile_id uuid := auth.uid();
  customer_profile ceaute.profile%rowtype;
  provider_page ceaute.provider_page%rowtype;
  selected_treatment ceaute.treatment%rowtype;
  location ceaute.provider_location%rowtype;
  booking_setting ceaute.provider_booking_setting%rowtype;
  unique_add_on_ids uuid[];
  selected_add_ons jsonb;
  selected_add_on_count integer;
  total_duration_minutes integer;
  total_price_pence bigint;
  requested_end_at timestamptz;
  hold_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  perform ceaute.expire_provider_booking_holds(target_provider_page_id);

  select * into customer_profile
  from ceaute.profile
  where id = current_profile_id;

  if customer_profile.id is null
    or nullif(btrim(customer_profile.full_name), '') is null
    or nullif(btrim(customer_profile.phone_e164), '') is null then
    raise exception 'Customer details are incomplete.';
  end if;

  select * into provider_page
  from ceaute.provider_page
  where id = target_provider_page_id
    and status = 'published';

  if provider_page.id is null then
    raise exception 'Provider page not found.';
  end if;

  select * into selected_treatment
  from ceaute.treatment
  where id = target_treatment_id
    and provider_page_id = target_provider_page_id
    and is_active = true;

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
    count(*),
    selected_treatment.duration_minutes + coalesce(sum(treatment_add_on.additional_duration_minutes), 0),
    selected_treatment.price_pence + coalesce(sum(treatment_add_on.additional_price_pence), 0)
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

  select * into location
  from ceaute.provider_location
  where provider_page_id = target_provider_page_id
  limit 1;

  select * into booking_setting
  from ceaute.provider_booking_setting
  where provider_page_id = target_provider_page_id;

  insert into ceaute.booking (
    customer_profile_id,
    provider_page_id,
    treatment_id,
    start_at,
    end_at,
    status,
    expires_at,
    customer_snapshot,
    service_snapshot
  )
  values (
    current_profile_id,
    target_provider_page_id,
    target_treatment_id,
    requested_start_at,
    requested_end_at,
    'awaiting_payment',
    now() + interval '5 minutes',
    jsonb_build_object(
      'full_name', customer_profile.full_name,
      'email', auth.jwt() ->> 'email',
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

create or replace function ceaute.complete_booking_payment_attempt(
  target_payment_attempt_id uuid,
  target_stripe_payment_intent_id text,
  target_stripe_checkout_session_id text
)
returns table (
  outcome text,
  booking_id uuid,
  amount_charged_pence bigint,
  ceaute_fee_pence bigint
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
begin
  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = payment_attempt.booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if payment_attempt.payment_status in ('succeeded', 'refunded') then
    return query select
      'already_processed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence;
    return;
  end if;

  if target_booking.status = 'confirmed' then
    update ceaute.booking_payment_attempt
    set payment_status = 'succeeded',
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_stripe_payment_intent_id),
        stripe_checkout_session_id = coalesce(stripe_checkout_session_id, target_stripe_checkout_session_id),
        failure_reason = null
    where id = payment_attempt.id
    returning * into payment_attempt;

    return query select
      'confirmed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence;
    return;
  end if;

  if target_booking.status = 'awaiting_payment'
    and target_booking.expires_at > now() then
    update ceaute.booking
    set status = 'confirmed',
        confirmed_at = coalesce(confirmed_at, now())
    where id = target_booking.id;

    update ceaute.booking_payment_attempt
    set payment_status = 'succeeded',
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_stripe_payment_intent_id),
        stripe_checkout_session_id = coalesce(stripe_checkout_session_id, target_stripe_checkout_session_id),
        failure_reason = null
    where id = payment_attempt.id
    returning * into payment_attempt;

    return query select
      'confirmed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence;
    return;
  end if;

  update ceaute.booking_payment_attempt
  set payment_status = 'refund_required',
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_stripe_payment_intent_id),
      stripe_checkout_session_id = coalesce(stripe_checkout_session_id, target_stripe_checkout_session_id),
      failure_reason = 'Booking was no longer confirmable after payment succeeded.'
  where id = payment_attempt.id
  returning * into payment_attempt;

  return query select
    'refund_required'::text,
    payment_attempt.booking_id,
    payment_attempt.amount_charged_pence,
    payment_attempt.ceaute_fee_pence;
end;
$$;

revoke all on function ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz)
from public, anon, authenticated;
revoke all on function ceaute.complete_booking_payment_attempt(uuid, text, text)
from public, anon, authenticated;

grant execute on function ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz)
to authenticated;
grant execute on function ceaute.complete_booking_payment_attempt(uuid, text, text)
to service_role;
