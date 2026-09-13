-- Make the Checkout request and its slot reservation one durable operation.
alter table ceaute.booking_payment_attempt
  add column if not exists checkout_request_payload jsonb,
  add column if not exists checkout_request_expires_at timestamptz,
  add column if not exists checkout_original_booking_expires_at timestamptz,
  add column if not exists checkout_creation_uncertain_at timestamptz;

drop function if exists ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text);

create function ceaute.claim_booking_checkout(
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

-- Preserve the SQL test/support signature while production supplies exact URLs.
create function ceaute.claim_booking_checkout(
  target_booking_id uuid,
  target_amount_charged_pence bigint,
  target_total_booking_value_pence bigint,
  target_amount_due_later_pence bigint,
  target_ceaute_fee_pence bigint,
  target_currency text,
  target_provider_stripe_account_id text
)
returns table (
  action text,
  payment_attempt_id uuid,
  claim_token uuid,
  checkout_idempotency_key text,
  stripe_checkout_session_id text,
  stripe_checkout_url text,
  stripe_checkout_expires_at timestamptz,
  payment_status text
)
language sql
security definer
set search_path = ceaute, public
as $$
  select
    claimed.action,
    claimed.payment_attempt_id,
    claimed.claim_token,
    claimed.checkout_idempotency_key,
    claimed.stripe_checkout_session_id,
    claimed.stripe_checkout_url,
    claimed.stripe_checkout_expires_at,
    claimed.payment_status
  from ceaute.claim_booking_checkout(
    target_booking_id,
    target_amount_charged_pence,
    target_total_booking_value_pence,
    target_amount_due_later_pence,
    target_ceaute_fee_pence,
    target_currency,
    target_provider_stripe_account_id,
    'https://ceaute.invalid/checkout/success',
    'https://ceaute.invalid/checkout/cancelled'
  ) as claimed;
$$;

create or replace function ceaute.record_booking_checkout_creation_uncertain(
  target_payment_attempt_id uuid,
  target_claim_token uuid,
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

  update ceaute.booking_payment_attempt
  set checkout_claim_token = null,
      checkout_claimed_at = null,
      checkout_creation_uncertain_at = coalesce(checkout_creation_uncertain_at, now()),
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Checkout creation outcome is unknown.'), 500)
  where id = target_payment_attempt_id
    and checkout_claim_token = target_claim_token
    and payment_status = 'checkout_creating'
    and stripe_checkout_session_id is null;

  if not found then
    raise exception 'Checkout claim is no longer active.';
  end if;
end;
$$;

revoke all on function ceaute.release_booking_checkout_claim(uuid, uuid, text)
from public, anon, authenticated, service_role;
drop function if exists ceaute.release_booking_checkout_claim(uuid, uuid, text);

create or replace function ceaute.reject_booking_checkout_creation(
  target_payment_attempt_id uuid,
  target_claim_token uuid,
  target_reason text
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null
    or payment_attempt.checkout_claim_token is distinct from target_claim_token
    or payment_attempt.payment_status <> 'checkout_creating'
    or payment_attempt.stripe_checkout_session_id is not null then
    raise exception 'Checkout claim is no longer active.';
  end if;

  update ceaute.booking_payment_attempt
  set payment_status = 'failed',
      checkout_claim_token = null,
      checkout_claimed_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Stripe rejected Checkout creation.'), 500)
  where id = payment_attempt.id;

  update ceaute.booking
  set status = case
        when payment_attempt.checkout_original_booking_expires_at > now()
          then status
        else 'cancelled'
      end,
      expires_at = payment_attempt.checkout_original_booking_expires_at
  where id = payment_attempt.booking_id
    and status = 'awaiting_payment';
end;
$$;

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
    or target_stripe_checkout_expires_at is null then
    raise exception 'Complete Stripe Checkout identifiers are required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  if payment_attempt.payment_status = 'checkout_created'
    and payment_attempt.stripe_checkout_session_id = target_stripe_checkout_session_id
    and payment_attempt.stripe_checkout_url = target_stripe_checkout_url
    and payment_attempt.stripe_checkout_expires_at = target_stripe_checkout_expires_at
    and payment_attempt.stripe_payment_intent_id is not distinct from target_stripe_payment_intent_id then
    return;
  end if;

  if payment_attempt.payment_status <> 'checkout_creating'
    or payment_attempt.checkout_claim_token is distinct from target_claim_token then
    raise exception 'Checkout claim is no longer active.';
  end if;

  if target_stripe_checkout_expires_at > payment_attempt.checkout_request_expires_at
    or target_stripe_checkout_expires_at < payment_attempt.checkout_request_expires_at - interval '2 minutes' then
    raise exception 'Stripe Checkout expiry does not match the persisted request.';
  end if;

  if payment_attempt.stripe_checkout_session_id is not null
    or payment_attempt.stripe_payment_intent_id is not null then
    raise exception 'Stripe payment identifiers cannot be replaced.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = payment_attempt.booking_id
  for update;

  if target_booking.status <> 'awaiting_payment'
    or target_booking.expires_at <= now() then
    raise exception 'Booking is no longer payable.';
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
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null
    or payment_attempt.payment_status <> 'checkout_creating'
    or payment_attempt.checkout_claim_token is distinct from target_claim_token
    or payment_attempt.stripe_checkout_session_id is not null then
    raise exception 'Checkout claim is no longer active.';
  end if;

  update ceaute.booking_payment_attempt
  set stripe_checkout_session_id = target_stripe_checkout_session_id,
      stripe_checkout_expires_at = target_stripe_checkout_expires_at,
      payment_status = 'expired',
      checkout_claim_token = null,
      checkout_claimed_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Checkout persistence failed.'), 500)
  where id = payment_attempt.id;

  update ceaute.booking
  set status = case
        when payment_attempt.checkout_original_booking_expires_at > now()
          then status
        else 'cancelled'
      end,
      expires_at = payment_attempt.checkout_original_booking_expires_at
  where id = payment_attempt.booking_id
    and status = 'awaiting_payment';
end;
$$;

revoke all on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_checkout_creation_uncertain(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.reject_booking_checkout_creation(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function ceaute.retire_unpersisted_booking_checkout(uuid, uuid, text, timestamptz, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text, text, text)
to service_role;
grant execute on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text)
to service_role;
grant execute on function ceaute.record_booking_checkout_creation_uncertain(uuid, uuid, text)
to service_role;
grant execute on function ceaute.reject_booking_checkout_creation(uuid, uuid, text)
to service_role;
grant execute on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
to service_role;
grant execute on function ceaute.retire_unpersisted_booking_checkout(uuid, uuid, text, timestamptz, text)
to service_role;
