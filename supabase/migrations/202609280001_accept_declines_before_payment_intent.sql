-- Stripe creates a Checkout Session's PaymentIntent only when the customer
-- pays, so record_booking_checkout_session stores none. A declined card then
-- sends payment_intent.payment_failed naming a PaymentIntent the attempt has
-- never seen, and the old check (null is distinct from any id) rejected it:
-- the webhook answered 500 and Stripe retried for three days.
--
-- A failure event may now name any PaymentIntent while the attempt has none
-- recorded. The event's PaymentIntent is not stored on the attempt:
-- complete_booking_payment_attempt rejects a PaymentIntent that differs from
-- a recorded one, and Stripe does not promise that a Checkout Session keeps
-- the same PaymentIntent after a decline, so storing it could stop a later
-- successful payment on the same page from confirming. The event row in
-- stripe_payment_event keeps the PaymentIntent. The payment_attempt_id in the
-- PaymentIntent's metadata, set by Ceaute through payment_intent_data on a
-- signed event, is what ties the event to the attempt.
--
-- Unchanged: a PaymentIntent that differs from a recorded one is still
-- rejected, the Checkout Session must still match, and a succeeded or refund
-- state is never downgraded.
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
    and payment_attempt.stripe_payment_intent_id is not null
    and payment_attempt.stripe_payment_intent_id <> target_stripe_payment_intent_id then
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

revoke all on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
from public, anon, authenticated, service_role;
grant execute on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
to service_role;
