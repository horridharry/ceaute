-- A card refund can report `succeeded` and fail later: the customer's bank
-- sends the money back, for example because the card has expired. Stripe
-- documents this for live mode (refunds can "appear to succeed and later
-- fail") and sends `refund.failed`; `failed` and `canceled` are final.
-- record_booking_refund_state treated `succeeded` as final and dropped that
-- message, so the booking kept saying the customer was refunded
-- (docs/reports/2026-09-28-event-order-sequences.md, bug 2).
--
-- Now a `failed` or `canceled` status moves a succeeded operation to the
-- same state a refund that fails straight away reaches: operation `failed`
-- (or `cancelled`), attempt `refund_failed`. Not `requires_review`: that
-- state means Stripe's history is unclear and nothing may touch it, whereas
-- here Stripe is definite. Neither state is retried, and retrying would not
-- help: the same idempotency key returns the same failed refund, and a new
-- refund to the same card would fail again.
--
-- The existing ordering rule is unchanged and still comes first: an event
-- older than the last one recorded is ignored, so an earlier `pending` can
-- never undo success, and a `pending` never undoes it at all.
--
-- The money: for a destination charge Stripe returns a failed refund to
-- Ceaute's platform balance. The transfer reversal and any application-fee
-- refund already made stay as they are, which is what the settlement rules
-- intended, so nothing is undone and no provider liability arises. Ceaute
-- holds the customer's money and a person must pay it back another way
-- (docs/refund-failure-response.md). So the first time an operation becomes
-- failed or cancelled, one operator email is queued (owner decision, 28
-- September 2026). The customer is not emailed; the operator contacts them.

alter table ceaute.booking_email_outbox
  drop constraint booking_email_outbox_event_type_check;

alter table ceaute.booking_email_outbox
  add constraint booking_email_outbox_event_type_check check (
    event_type in (
      'booking_confirmed_customer',
      'booking_confirmed_provider',
      'customer_cancelled_customer',
      'customer_cancelled_provider',
      'provider_cancelled_customer',
      'provider_cancelled_provider',
      'dispute_opened_operator',
      'dispute_funds_withdrawn_operator',
      'dispute_funds_reinstated_operator',
      'dispute_closed_operator',
      'late_payment_refunded_customer',
      'refund_failed_operator'
    )
  );

drop function if exists ceaute.record_booking_refund_state(uuid, text, text, text, bigint, text, text, bigint);

create function ceaute.record_booking_refund_state(
  target_refund_operation_id uuid,
  target_stripe_refund_id text,
  target_stripe_payment_intent_id text,
  target_stripe_charge_id text,
  target_amount_pence bigint,
  target_status text,
  target_failure_reason text default null,
  target_event_created_at bigint default null,
  target_operator_email text default null
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  refund_operation ceaute.booking_refund_operation%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
  target_provider_page ceaute.provider_page%rowtype;
  normalized_status text;
  event_created_at timestamptz;
  failure_text text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  normalized_status := case target_status
    when 'succeeded' then 'succeeded'
    when 'failed' then 'failed'
    when 'canceled' then 'cancelled'
    when 'cancelled' then 'cancelled'
    else 'pending'
  end;
  event_created_at := case when target_event_created_at is not null
    then to_timestamp(target_event_created_at) end;
  failure_text := left(
    coalesce(nullif(btrim(target_failure_reason), ''), 'Stripe refund failed.'), 500
  );

  select * into refund_operation
  from ceaute.booking_refund_operation
  where id = target_refund_operation_id
  for update;

  if refund_operation.id is null then
    raise exception 'Refund operation not found.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = refund_operation.booking_payment_attempt_id
  for update;

  if nullif(btrim(target_stripe_refund_id), '') is null
    or refund_operation.stripe_payment_intent_id is distinct from target_stripe_payment_intent_id
    or payment_attempt.stripe_payment_intent_id is distinct from target_stripe_payment_intent_id
    or refund_operation.expected_amount_pence is distinct from target_amount_pence
    or (refund_operation.stripe_refund_id is not null
      and refund_operation.stripe_refund_id <> target_stripe_refund_id)
    or (refund_operation.stripe_charge_id is not null
      and refund_operation.stripe_charge_id is distinct from target_stripe_charge_id) then
    raise exception 'Stripe refund does not match the persisted refund operation.';
  end if;

  -- An older event than the last one recorded changes nothing.
  if event_created_at is not null
    and refund_operation.last_stripe_event_created_at is not null
    and event_created_at < refund_operation.last_stripe_event_created_at then
    return;
  end if;

  -- Success gives way only to Stripe's final failure states; failure and
  -- cancellation are final; review is left for a person unless Stripe is
  -- definite.
  if (refund_operation.status = 'succeeded'
      and normalized_status not in ('failed', 'cancelled'))
    or (refund_operation.status in ('failed', 'cancelled')
      and normalized_status <> refund_operation.status)
    or (refund_operation.status = 'requires_review' and normalized_status = 'pending') then
    return;
  end if;

  update ceaute.booking_refund_operation
  set stripe_refund_id = target_stripe_refund_id,
      stripe_charge_id = coalesce(stripe_charge_id, target_stripe_charge_id),
      status = normalized_status,
      failure_reason = case when normalized_status in ('failed', 'cancelled')
        then failure_text else null end,
      processing_started_at = null,
      stripe_updated_at = now(),
      last_stripe_event_created_at = coalesce(event_created_at, last_stripe_event_created_at),
      -- Kept after a later failure: it records when Stripe reported success.
      succeeded_at = case when normalized_status = 'succeeded' then coalesce(succeeded_at, now()) else succeeded_at end,
      failed_at = case when normalized_status = 'failed' then coalesce(failed_at, now()) else failed_at end,
      cancelled_at = case when normalized_status = 'cancelled' then coalesce(cancelled_at, now()) else cancelled_at end
  where id = refund_operation.id;

  update ceaute.booking_payment_attempt
  set stripe_refund_id = target_stripe_refund_id,
      payment_status = case
        when normalized_status = 'succeeded' then 'refunded'
        when normalized_status in ('failed', 'cancelled') then 'refund_failed'
        else 'refund_required'
      end,
      -- The attempt says whether the customer has their money now, so a
      -- refund that failed after succeeding is no longer refunded.
      refunded_at = case
        when normalized_status = 'succeeded' then coalesce(refunded_at, now())
        when normalized_status in ('failed', 'cancelled') then null
        else refunded_at
      end,
      refund_failed_at = case when normalized_status in ('failed', 'cancelled') then coalesce(refund_failed_at, now()) else null end,
      failure_reason = case
        when normalized_status in ('failed', 'cancelled') then failure_text
        when normalized_status = 'pending' then 'Stripe refund is pending.'
        else null
      end
  where id = payment_attempt.id;

  -- Only on the move into failure, so a replay queues nothing. The outbox's
  -- unique key also keeps it to one email per booking.
  if normalized_status in ('failed', 'cancelled')
    and refund_operation.status not in ('failed', 'cancelled')
    and nullif(btrim(target_operator_email), '') is not null then

    select * into target_booking
    from ceaute.booking
    where id = refund_operation.booking_id;

    select * into target_provider_page
    from ceaute.provider_page
    where id = target_booking.provider_page_id;

    -- No customer contact details and no address, as for dispute alerts.
    insert into ceaute.booking_email_outbox (
      event_type, booking_id, recipient_email, recipient_role, payload
    ) values (
      'refund_failed_operator',
      refund_operation.booking_id,
      btrim(target_operator_email),
      'operator',
      jsonb_build_object(
        'booking_id', refund_operation.booking_id,
        'refund_purpose', refund_operation.purpose,
        'refund_status', normalized_status,
        'refund_amount_pence', refund_operation.expected_amount_pence,
        'failure_reason', failure_text,
        'reported_success_first', refund_operation.status = 'succeeded',
        'stripe_refund_id', target_stripe_refund_id,
        'stripe_payment_intent_id', target_stripe_payment_intent_id,
        'provider_name', coalesce(target_provider_page.display_name, 'Unknown provider'),
        'provider_username', target_provider_page.username,
        'treatment_name', target_booking.service_snapshot ->> 'treatment_name',
        'start_at', target_booking.start_at,
        'cancelled_by', target_booking.cancelled_by
      )
    )
    on conflict (booking_id, event_type, recipient_email) do nothing;
  end if;
end;
$$;

revoke all on function ceaute.record_booking_refund_state(uuid, text, text, text, bigint, text, text, bigint, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.record_booking_refund_state(uuid, text, text, text, bigint, text, text, bigint, text)
to service_role;
