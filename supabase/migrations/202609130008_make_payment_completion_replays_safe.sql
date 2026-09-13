-- A replay for the payment that originally confirmed a now-cancelled booking
-- must not create a second, full-value late-payment refund entitlement.
create or replace function ceaute.complete_booking_payment_attempt(
  target_payment_attempt_id uuid,
  target_stripe_payment_intent_id text,
  target_stripe_checkout_session_id text,
  target_payment_status text,
  target_currency text,
  target_amount_total bigint
)
returns table (
  outcome text,
  booking_id uuid,
  amount_charged_pence bigint,
  ceaute_fee_pence bigint,
  refund_operation_id uuid
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
  created_refund_operation_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_stripe_payment_intent_id), '') is null
    or nullif(btrim(target_stripe_checkout_session_id), '') is null then
    raise exception 'Verified Stripe payment identifiers are required.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if payment_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  if payment_attempt.stripe_checkout_session_id is distinct from target_stripe_checkout_session_id then
    raise exception 'Stripe Checkout Session does not match the payment attempt.';
  end if;

  if payment_attempt.stripe_payment_intent_id is not null
    and payment_attempt.stripe_payment_intent_id <> target_stripe_payment_intent_id then
    raise exception 'Stripe PaymentIntent does not match the payment attempt.';
  end if;

  if target_payment_status <> 'paid'
    or lower(coalesce(target_currency, '')) <> payment_attempt.currency
    or target_amount_total is distinct from payment_attempt.amount_charged_pence then
    raise exception 'Stripe payment details do not match the payment attempt.';
  end if;

  if payment_attempt.stripe_payment_intent_id is null then
    update ceaute.booking_payment_attempt
    set stripe_payment_intent_id = target_stripe_payment_intent_id
    where id = payment_attempt.id
      and stripe_payment_intent_id is null
    returning * into payment_attempt;
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
      'already_processed'::text, payment_attempt.booking_id,
      payment_attempt.amount_charged_pence, payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  if target_booking.confirming_payment_attempt_id = payment_attempt.id
    and target_booking.confirmed_at is not null
    and (
      target_booking.status = 'cancelled'
      or payment_attempt.payment_status in ('refund_required', 'refund_failed')
    ) then
    return query select
      'already_processed'::text, payment_attempt.booking_id,
      payment_attempt.amount_charged_pence, payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  if target_booking.status = 'awaiting_payment' and target_booking.expires_at > now() then
    update ceaute.booking
    set status = 'confirmed',
        confirmed_at = coalesce(confirmed_at, now()),
        confirming_payment_attempt_id = payment_attempt.id
    where id = target_booking.id;

    update ceaute.booking_payment_attempt
    set payment_status = 'succeeded', failure_reason = null
    where id = payment_attempt.id;

    return query select
      'confirmed'::text, payment_attempt.booking_id,
      payment_attempt.amount_charged_pence, payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  if target_booking.status in ('confirmed', 'completed')
    and target_booking.confirming_payment_attempt_id = payment_attempt.id then
    update ceaute.booking_payment_attempt
    set payment_status = 'succeeded', failure_reason = null
    where id = payment_attempt.id;

    return query select
      'already_processed'::text, payment_attempt.booking_id,
      payment_attempt.amount_charged_pence, payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  insert into ceaute.booking_refund_operation (
    booking_id, booking_payment_attempt_id, purpose,
    expected_amount_pence, idempotency_key, stripe_payment_intent_id
  ) values (
    payment_attempt.booking_id,
    payment_attempt.id,
    case when target_booking.status in ('confirmed', 'completed')
      then 'duplicate_payment' else 'late_payment' end,
    payment_attempt.amount_charged_pence,
    'ceaute-refund-' ||
      case when target_booking.status in ('confirmed', 'completed')
        then 'duplicate-payment-' else 'late-payment-' end ||
      payment_attempt.id::text,
    payment_attempt.stripe_payment_intent_id
  )
  on conflict (booking_payment_attempt_id, purpose) do update
    set updated_at = ceaute.booking_refund_operation.updated_at
  returning id into created_refund_operation_id;

  update ceaute.booking_payment_attempt
  set payment_status = case when target_booking.status in ('confirmed', 'completed')
        then 'duplicate_paid' else 'refund_required' end,
      refund_amount_pence = payment_attempt.amount_charged_pence,
      retained_amount_pence = 0,
      refund_requested_at = coalesce(refund_requested_at, now()),
      failure_reason = case when target_booking.status in ('confirmed', 'completed')
        then 'A different payment already confirmed this booking.'
        else 'Booking was no longer confirmable after payment succeeded.' end
  where id = payment_attempt.id;

  return query select
    case when target_booking.status in ('confirmed', 'completed')
      then 'duplicate_payment'::text else 'refund_required'::text end,
    payment_attempt.booking_id,
    payment_attempt.amount_charged_pence,
    payment_attempt.ceaute_fee_pence,
    created_refund_operation_id;
end;
$$;

revoke all on function ceaute.complete_booking_payment_attempt(uuid, text, text, text, text, bigint)
from public, anon, authenticated, service_role;
grant execute on function ceaute.complete_booking_payment_attempt(uuid, text, text, text, text, bigint)
to service_role;
