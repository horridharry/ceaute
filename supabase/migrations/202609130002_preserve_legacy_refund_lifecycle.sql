-- Preserve refund history created before refund operations were introduced.
insert into ceaute.booking_refund_operation (
  booking_id,
  booking_payment_attempt_id,
  purpose,
  expected_amount_pence,
  idempotency_key,
  stripe_refund_id,
  status,
  failure_reason,
  succeeded_at,
  failed_at,
  created_at
)
select
  payment_attempt.booking_id,
  payment_attempt.id,
  case when booking.status = 'cancelled' then 'cancellation' else 'late_payment' end,
  least(
    payment_attempt.amount_charged_pence,
    coalesce(payment_attempt.refund_amount_pence, payment_attempt.amount_charged_pence)
  ),
  'ceaute-refund-' ||
    case when booking.status = 'cancelled' then 'cancellation-' else 'late-payment-' end ||
    payment_attempt.id::text,
  payment_attempt.stripe_refund_id,
  case payment_attempt.payment_status
    when 'refunded' then 'succeeded'
    when 'refund_failed' then 'failed'
    else 'requested'
  end,
  payment_attempt.failure_reason,
  case when payment_attempt.payment_status = 'refunded'
    then coalesce(payment_attempt.refunded_at, payment_attempt.updated_at) end,
  case when payment_attempt.payment_status = 'refund_failed'
    then coalesce(payment_attempt.refund_failed_at, payment_attempt.updated_at) end,
  coalesce(payment_attempt.refund_requested_at, payment_attempt.created_at)
from ceaute.booking_payment_attempt as payment_attempt
join ceaute.booking as booking on booking.id = payment_attempt.booking_id
where payment_attempt.payment_status in ('refund_required', 'refunded', 'refund_failed')
  and least(
    payment_attempt.amount_charged_pence,
    coalesce(payment_attempt.refund_amount_pence, payment_attempt.amount_charged_pence)
  ) > 0
on conflict (booking_payment_attempt_id, purpose) do nothing;

create or replace function ceaute.find_booking_refund_operation(
  target_stripe_refund_id text,
  target_stripe_payment_intent_id text,
  target_amount_pence bigint
)
returns uuid
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select refund_operation.id
  from ceaute.booking_refund_operation as refund_operation
  join ceaute.booking_payment_attempt as payment_attempt
    on payment_attempt.id = refund_operation.booking_payment_attempt_id
  where refund_operation.stripe_refund_id = target_stripe_refund_id
    and payment_attempt.stripe_payment_intent_id = target_stripe_payment_intent_id
    and refund_operation.expected_amount_pence = target_amount_pence;
$$;

revoke all on function ceaute.find_booking_refund_operation(text, text, bigint)
from public, anon, authenticated, service_role;

grant execute on function ceaute.find_booking_refund_operation(text, text, bigint)
to service_role;
