-- Holds snapshot percentage terms, last 10 minutes, and are refused for a page
-- that cannot take bookings; Checkout charges exactly the snapshot.
--
-- The hold (approved 23 September 2026):
--   * lasts 10 minutes (was 5);
--   * is refused unless ceaute.provider_page_accepts_new_bookings: published,
--     complete percentage terms, Stripe ready, the current agreement accepted,
--     no outstanding balance;
--   * is refused below £1, the minimum online payment;
--   * snapshots payment_mode, deposit_percent, amount_due_now_pence and, as
--     commitment_amount_pence, what a late customer cancellation keeps, all
--     from ceaute.booking_payment_terms. prepare_booking_cancellation already
--     retains least(commitment_amount_pence, amount paid), so cancellation and
--     refunds need no change and old snapshots keep their old meaning.
--
-- The Checkout claim (unchanged otherwise):
--   * still extends the hold to the Checkout request's expiry, 31 minutes, and
--     record_booking_checkout_session still sets it to Stripe's exact expiry;
--     a rejected or unusable Session still restores the original 10 minutes;
--   * now refuses an amount that differs from the snapshot's amount_due_now
--     (snapshots made before this migration keep the old behaviour);
--   * now returns 'provider_unavailable' when the provider has not accepted the
--     current agreement or has an outstanding balance, so no new payment can be
--     taken for them even if the application's own check were bypassed;
--   * now sends the customer's email to Stripe (customer_email).

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

-- Checkout ----------------------------------------------------------------------

create or replace function ceaute.claim_booking_checkout(
  target_booking_id uuid,
  target_amount_charged_pence bigint,
  target_total_booking_value_pence bigint,
  target_amount_due_later_pence bigint,
  target_ceaute_fee_pence bigint,
  target_currency text,
  target_provider_stripe_account_id text,
  target_success_url text,
  target_cancel_url text
)
returns table (
  action text,
  payment_attempt_id uuid,
  claim_token uuid,
  checkout_idempotency_key text,
  checkout_request_payload jsonb,
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  stripe_checkout_expires_at timestamptz,
  payment_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
#variable_conflict use_column
declare
  target_booking ceaute.booking%rowtype;
  active_attempt ceaute.booking_payment_attempt%rowtype;
  successful_attempt ceaute.booking_payment_attempt%rowtype;
  new_claim_token uuid := gen_random_uuid();
  new_attempt_id uuid := gen_random_uuid();
  next_attempt_number integer;
  request_expires_at timestamptz := date_trunc('second', now()) + interval '31 minutes';
  request_payload jsonb;
  product_name text;
  customer_email text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if target_amount_charged_pence <= 0
    or target_total_booking_value_pence < target_amount_charged_pence
    or target_amount_due_later_pence <> target_total_booking_value_pence - target_amount_charged_pence
    or target_ceaute_fee_pence < 0
    or target_ceaute_fee_pence > target_amount_charged_pence
    or lower(target_currency) <> 'gbp'
    or nullif(btrim(target_provider_stripe_account_id), '') is null
    or target_success_url !~ '^https?://'
    or target_cancel_url !~ '^https?://' then
    raise exception 'Invalid authoritative Checkout terms.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = target_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  select * into successful_attempt
  from ceaute.booking_payment_attempt
  where booking_id = target_booking.id
    and payment_status in ('succeeded', 'duplicate_paid', 'refund_required', 'refunded', 'refund_failed')
  order by attempt_number desc
  limit 1;

  if successful_attempt.id is not null then
    return query select
      'terminal'::text, successful_attempt.id, null::uuid,
      successful_attempt.checkout_idempotency_key,
      successful_attempt.checkout_request_payload,
      successful_attempt.stripe_checkout_session_id,
      successful_attempt.stripe_checkout_url,
      successful_attempt.stripe_checkout_expires_at,
      successful_attempt.payment_status;
    return;
  end if;

  if target_booking.status <> 'awaiting_payment' or target_booking.expires_at <= now() then
    return query select
      'booking_unavailable'::text, null::uuid, null::uuid, null::text, null::jsonb,
      null::text, null::text, null::timestamptz, target_booking.status;
    return;
  end if;

  -- A snapshot made on percentage terms states exactly what is due now; the
  -- Checkout must charge that and nothing else.
  if target_booking.service_snapshot ? 'amount_due_now_pence'
    and (
      target_amount_charged_pence
        is distinct from nullif(target_booking.service_snapshot ->> 'amount_due_now_pence', '')::bigint
      or target_total_booking_value_pence
        is distinct from nullif(target_booking.service_snapshot ->> 'total_price_pence', '')::bigint
    ) then
    raise exception 'Payment attempt no longer matches authoritative booking terms.';
  end if;

  -- No new payment for a provider who has not accepted the current agreement
  -- or who owes Ceaute money. The application checks the same thing first and
  -- shows the customer a neutral notice; this makes it the database's rule.
  if not exists (
      select 1
      from ceaute.provider_agreement_acceptance
      where provider_agreement_acceptance.provider_page_id = target_booking.provider_page_id
        and provider_agreement_acceptance.agreement_version
          = ceaute.current_provider_agreement_version()
    )
    or exists (
      select 1
      from ceaute.provider_liability
      where provider_liability.provider_page_id = target_booking.provider_page_id
        and provider_liability.status = 'outstanding'
        and provider_liability.outstanding_pence > 0
    ) then
    return query select
      'provider_unavailable'::text, null::uuid, null::uuid, null::text, null::jsonb,
      null::text, null::text, null::timestamptz, target_booking.status;
    return;
  end if;

  customer_email := nullif(btrim(target_booking.customer_snapshot ->> 'email'), '');

  select * into active_attempt
  from ceaute.booking_payment_attempt
  where booking_id = target_booking.id
    and payment_status in ('created', 'checkout_creating', 'checkout_created')
  order by attempt_number desc
  limit 1
  for update;

  if active_attempt.id is not null then
    if active_attempt.amount_charged_pence <> target_amount_charged_pence
      or active_attempt.total_booking_value_pence <> target_total_booking_value_pence
      or active_attempt.amount_due_later_pence <> target_amount_due_later_pence
      or active_attempt.ceaute_fee_pence <> target_ceaute_fee_pence
      or active_attempt.currency <> lower(target_currency)
      or active_attempt.provider_stripe_account_id <> target_provider_stripe_account_id then
      raise exception 'Payment attempt no longer matches authoritative booking terms.';
    end if;

    if active_attempt.payment_status = 'checkout_created' then
      return query select
        'reuse'::text, active_attempt.id, null::uuid,
        active_attempt.checkout_idempotency_key, active_attempt.checkout_request_payload,
        active_attempt.stripe_checkout_session_id, active_attempt.stripe_checkout_url,
        active_attempt.stripe_checkout_expires_at, active_attempt.payment_status;
      return;
    end if;

    if active_attempt.payment_status = 'checkout_creating'
      and active_attempt.checkout_request_payload is null then
      raise exception 'An older Checkout creation has an unknown outcome and requires review.';
    end if;

    if active_attempt.payment_status = 'checkout_creating'
      and active_attempt.checkout_claimed_at > now() - interval '2 minutes' then
      return query select
        'processing'::text, active_attempt.id, null::uuid,
        active_attempt.checkout_idempotency_key, active_attempt.checkout_request_payload,
        active_attempt.stripe_checkout_session_id, active_attempt.stripe_checkout_url,
        active_attempt.stripe_checkout_expires_at, active_attempt.payment_status;
      return;
    end if;

    if active_attempt.checkout_request_payload is null then
      request_expires_at := date_trunc('second', now()) + interval '31 minutes';
      product_name := concat(
        coalesce(nullif(target_booking.service_snapshot ->> 'provider_display_name', ''), 'Ceaute'),
        ' - ',
        coalesce(nullif(target_booking.service_snapshot ->> 'treatment_name', ''), 'booking')
      );
      request_payload := jsonb_strip_nulls(jsonb_build_object(
        'mode', 'payment',
        'allowed_payment_method_types', jsonb_build_array('card'),
        'expires_at', extract(epoch from request_expires_at)::bigint,
        'customer_email', customer_email,
        'line_items', jsonb_build_array(jsonb_build_object(
          'quantity', 1,
          'price_data', jsonb_build_object(
            'currency', lower(target_currency),
            'unit_amount', target_amount_charged_pence,
            'product_data', jsonb_build_object('name', product_name)
          )
        )),
        'success_url', target_success_url,
        'cancel_url', target_cancel_url,
        'metadata', jsonb_build_object(
          'booking_id', target_booking.id::text,
          'payment_attempt_id', active_attempt.id::text
        ),
        'payment_intent_data', jsonb_strip_nulls(jsonb_build_object(
          'application_fee_amount', case when target_ceaute_fee_pence > 0 then target_ceaute_fee_pence end,
          'transfer_data', jsonb_build_object('destination', target_provider_stripe_account_id),
          'metadata', jsonb_build_object(
            'booking_id', target_booking.id::text,
            'payment_attempt_id', active_attempt.id::text
          )
        ))
      ));
    else
      request_expires_at := active_attempt.checkout_request_expires_at;
      request_payload := active_attempt.checkout_request_payload;
    end if;

    update ceaute.booking_payment_attempt
    set payment_status = 'checkout_creating',
        checkout_claim_token = new_claim_token,
        checkout_claimed_at = now(),
        checkout_request_expires_at = request_expires_at,
        checkout_request_payload = request_payload,
        checkout_original_booking_expires_at = coalesce(
          checkout_original_booking_expires_at,
          target_booking.expires_at
        ),
        failure_reason = null
    where id = active_attempt.id
    returning * into active_attempt;
  else
    select coalesce(max(attempt_number), 0) + 1 into next_attempt_number
    from ceaute.booking_payment_attempt
    where booking_id = target_booking.id;

    product_name := concat(
      coalesce(nullif(target_booking.service_snapshot ->> 'provider_display_name', ''), 'Ceaute'),
      ' - ',
      coalesce(nullif(target_booking.service_snapshot ->> 'treatment_name', ''), 'booking')
    );
    request_payload := jsonb_strip_nulls(jsonb_build_object(
      'mode', 'payment',
      'allowed_payment_method_types', jsonb_build_array('card'),
      'expires_at', extract(epoch from request_expires_at)::bigint,
      'customer_email', customer_email,
      'line_items', jsonb_build_array(jsonb_build_object(
        'quantity', 1,
        'price_data', jsonb_build_object(
          'currency', lower(target_currency),
          'unit_amount', target_amount_charged_pence,
          'product_data', jsonb_build_object('name', product_name)
        )
      )),
      'success_url', target_success_url,
      'cancel_url', target_cancel_url,
      'metadata', jsonb_build_object(
        'booking_id', target_booking.id::text,
        'payment_attempt_id', new_attempt_id::text
      ),
      'payment_intent_data', jsonb_strip_nulls(jsonb_build_object(
        'application_fee_amount', case when target_ceaute_fee_pence > 0 then target_ceaute_fee_pence end,
        'transfer_data', jsonb_build_object('destination', target_provider_stripe_account_id),
        'metadata', jsonb_build_object(
          'booking_id', target_booking.id::text,
          'payment_attempt_id', new_attempt_id::text
        )
      ))
    ));

    insert into ceaute.booking_payment_attempt (
      id, booking_id, attempt_number, amount_charged_pence,
      total_booking_value_pence, amount_due_later_pence, ceaute_fee_pence,
      currency, payment_status, provider_stripe_account_id,
      checkout_claim_token, checkout_claimed_at, checkout_idempotency_key,
      checkout_request_payload, checkout_request_expires_at,
      checkout_original_booking_expires_at
    ) values (
      new_attempt_id, target_booking.id, next_attempt_number,
      target_amount_charged_pence, target_total_booking_value_pence,
      target_amount_due_later_pence, target_ceaute_fee_pence,
      lower(target_currency), 'checkout_creating', target_provider_stripe_account_id,
      new_claim_token, now(), 'ceaute-checkout-' || new_attempt_id::text,
      request_payload, request_expires_at, target_booking.expires_at
    )
    returning * into active_attempt;
  end if;

  -- The separate extension while Checkout is open: the hold now lasts as long
  -- as the Checkout request can (31 minutes; Stripe's minimum Session life is
  -- 30), and record_booking_checkout_session narrows it to Stripe's own expiry.
  update ceaute.booking
  set expires_at = active_attempt.checkout_request_expires_at
  where id = target_booking.id
    and status = 'awaiting_payment';

  return query select
    'create'::text, active_attempt.id, active_attempt.checkout_claim_token,
    active_attempt.checkout_idempotency_key, active_attempt.checkout_request_payload,
    active_attempt.stripe_checkout_session_id, active_attempt.stripe_checkout_url,
    active_attempt.stripe_checkout_expires_at, active_attempt.payment_status;
end;
$$;

revoke all on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text, text, text)
from public, anon, authenticated, service_role;
grant execute on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text, text, text)
to service_role;
