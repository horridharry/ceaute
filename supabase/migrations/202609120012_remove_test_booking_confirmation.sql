revoke all on function ceaute.confirm_test_booking_hold(uuid)
from public, anon, authenticated, service_role;

drop function if exists ceaute.confirm_test_booking_hold(uuid);

-- Booking confirmation is performed only by the payment-completion operation.
-- Backend callers do not need a generic table update grant for this transition.
revoke update on table ceaute.booking from service_role;

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

  select * into target_booking
  from ceaute.booking
  where id = payment_attempt.booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if payment_attempt.payment_status = 'succeeded'
    or payment_attempt.payment_status = 'refunded' then
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

revoke all on function ceaute.complete_booking_payment_attempt(uuid, text, text)
from public, anon, authenticated;

grant execute on function ceaute.complete_booking_payment_attempt(uuid, text, text)
to service_role;
