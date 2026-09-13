-- Browser callers must not be able to bypass the authoritative availability
-- calculation. Hold insertion is now a narrowly scoped backend operation.
revoke all on function ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz)
from public, anon, authenticated, service_role;

drop function if exists ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz);

create function ceaute.create_validated_booking_hold(
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

  perform ceaute.expire_provider_booking_holds(target_provider_page_id);

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

  select * into location
  from ceaute.provider_location
  where provider_page_id = target_provider_page_id
    and is_active = true
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
  ) values (
    target_customer_profile_id,
    target_provider_page_id,
    target_treatment_id,
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

revoke all on function ceaute.replace_expired_checkout_attempt(uuid)
from public, anon, authenticated, service_role;

drop function if exists ceaute.replace_expired_checkout_attempt(uuid);

-- A Checkout Session and its slot reservation share one authoritative expiry.
update ceaute.booking
set expires_at = payment_attempt.stripe_checkout_expires_at
from ceaute.booking_payment_attempt as payment_attempt
where payment_attempt.booking_id = booking.id
  and booking.status = 'awaiting_payment'
  and payment_attempt.payment_status = 'checkout_created'
  and payment_attempt.stripe_checkout_expires_at > now()
  and booking.expires_at is distinct from payment_attempt.stripe_checkout_expires_at;

create or replace function ceaute.record_booking_checkout_session(
  target_payment_attempt_id uuid,
  target_claim_token uuid,
  target_stripe_checkout_session_id text,
  target_stripe_payment_intent_id text,
  target_stripe_checkout_url text,
  target_stripe_checkout_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_stripe_checkout_session_id), '') is null
    or nullif(btrim(target_stripe_checkout_url), '') is null
    or target_stripe_checkout_expires_at is null
    or target_stripe_checkout_expires_at <= now()
    or target_stripe_checkout_expires_at > now() + interval '31 minutes' then
    raise exception 'Complete active Stripe Checkout identifiers are required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null
    or payment_attempt.payment_status <> 'checkout_creating'
    or payment_attempt.checkout_claim_token is distinct from target_claim_token then
    raise exception 'Checkout claim is no longer active.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = payment_attempt.booking_id
  for update;

  if target_booking.status <> 'awaiting_payment'
    or target_booking.expires_at <= now() then
    raise exception 'Booking is no longer payable.';
  end if;

  if payment_attempt.stripe_checkout_session_id is not null
    or payment_attempt.stripe_payment_intent_id is not null then
    raise exception 'Stripe payment identifiers cannot be replaced.';
  end if;

  update ceaute.booking_payment_attempt
  set stripe_checkout_session_id = target_stripe_checkout_session_id,
      stripe_payment_intent_id = target_stripe_payment_intent_id,
      stripe_checkout_url = target_stripe_checkout_url,
      stripe_checkout_expires_at = target_stripe_checkout_expires_at,
      payment_status = 'checkout_created',
      checkout_claim_token = null,
      checkout_claimed_at = null,
      failure_reason = null
  where id = payment_attempt.id;

  update ceaute.booking
  set expires_at = target_stripe_checkout_expires_at
  where id = target_booking.id;
end;
$$;

create or replace function ceaute.retire_unpersisted_booking_checkout(
  target_payment_attempt_id uuid,
  target_claim_token uuid,
  target_stripe_checkout_session_id text,
  target_stripe_checkout_expires_at timestamptz,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_stripe_checkout_session_id), '') is null then
    raise exception 'Stripe Checkout Session is required.';
  end if;

  update ceaute.booking_payment_attempt
  set stripe_checkout_session_id = target_stripe_checkout_session_id,
      stripe_checkout_expires_at = target_stripe_checkout_expires_at,
      payment_status = 'expired',
      checkout_claim_token = null,
      checkout_claimed_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Checkout persistence failed.'), 500)
  where id = target_payment_attempt_id
    and payment_status = 'checkout_creating'
    and checkout_claim_token = target_claim_token
    and stripe_checkout_session_id is null;

  if not found then
    raise exception 'Checkout claim is no longer active.';
  end if;
end;
$$;

create or replace function ceaute.mark_booking_payment_attempt_failed(
  target_payment_attempt_id uuid,
  target_stripe_checkout_session_id text,
  target_stripe_payment_intent_id text,
  target_reason text,
  target_expired boolean default false
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  if target_stripe_checkout_session_id is not null
    and payment_attempt.stripe_checkout_session_id is distinct from target_stripe_checkout_session_id then
    raise exception 'Stripe Checkout Session does not match the payment attempt.';
  end if;

  if target_stripe_payment_intent_id is not null
    and payment_attempt.stripe_payment_intent_id is distinct from target_stripe_payment_intent_id then
    raise exception 'Stripe PaymentIntent does not match the payment attempt.';
  end if;

  if payment_attempt.payment_status in ('succeeded', 'duplicate_paid', 'refund_required', 'refunded', 'refund_failed') then
    return;
  end if;

  update ceaute.booking_payment_attempt
  set payment_status = case when target_expired then 'expired' else 'failed' end,
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Stripe payment failed.'), 500),
      checkout_claim_token = null,
      checkout_claimed_at = null
  where id = payment_attempt.id;

  if target_expired then
    select * into target_booking
    from ceaute.booking
    where id = payment_attempt.booking_id
    for update;

    if target_booking.status = 'awaiting_payment'
      and not exists (
        select 1
        from ceaute.booking_payment_attempt as other_attempt
        where other_attempt.booking_id = target_booking.id
          and other_attempt.id <> payment_attempt.id
          and other_attempt.payment_status = 'checkout_created'
          and other_attempt.stripe_checkout_expires_at > now()
      ) then
      update ceaute.booking
      set status = 'cancelled'
      where id = target_booking.id
        and status = 'awaiting_payment';
    end if;
  end if;
end;
$$;

revoke all on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function ceaute.retire_unpersisted_booking_checkout(uuid, uuid, text, timestamptz, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
from public, anon, authenticated, service_role;

grant execute on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
to service_role;
grant execute on function ceaute.retire_unpersisted_booking_checkout(uuid, uuid, text, timestamptz, text)
to service_role;
grant execute on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
to service_role;
