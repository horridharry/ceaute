-- Exclude the operation being idempotently upserted from the entitlement sum;
-- distinct refund purposes still share the captured-payment cap.
create or replace function ceaute.validate_booking_refund_entitlement()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  other_entitlement bigint;
begin
  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = new.booking_payment_attempt_id
  for update;

  if payment_attempt.id is null
    or payment_attempt.booking_id <> new.booking_id
    or nullif(btrim(payment_attempt.stripe_payment_intent_id), '') is null then
    raise exception 'Refund operation is not tied to a captured payment.';
  end if;

  if new.stripe_payment_intent_id is null then
    new.stripe_payment_intent_id := payment_attempt.stripe_payment_intent_id;
  elsif new.stripe_payment_intent_id <> payment_attempt.stripe_payment_intent_id then
    raise exception 'Refund PaymentIntent does not match the captured payment.';
  end if;

  select coalesce(sum(existing.expected_amount_pence), 0)
  into other_entitlement
  from ceaute.booking_refund_operation as existing
  where existing.stripe_payment_intent_id = new.stripe_payment_intent_id
    and existing.id <> new.id
    and not (
      existing.booking_payment_attempt_id = new.booking_payment_attempt_id
      and existing.purpose = new.purpose
    );

  if new.expected_amount_pence > payment_attempt.amount_charged_pence
    or other_entitlement + new.expected_amount_pence > payment_attempt.amount_charged_pence then
    raise exception 'Total refund entitlement exceeds the captured amount.';
  end if;

  return new;
end;
$$;

revoke all on function ceaute.validate_booking_refund_entitlement()
from public, anon, authenticated, service_role;
