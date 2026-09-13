-- Preserve refund identity and make automatic refund processing monotonic.
alter table ceaute.booking_refund_operation
  drop constraint if exists booking_refund_operation_status_check;

alter table ceaute.booking_refund_operation
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_charge_id text,
  add column if not exists create_attempted_at timestamptz,
  add column if not exists last_stripe_event_created_at timestamptz,
  add column if not exists requires_review_at timestamptz,
  add constraint booking_refund_operation_status_check check (
    status in (
      'requested', 'processing', 'pending', 'succeeded', 'failed',
      'cancelled', 'requires_review'
    )
  );

update ceaute.booking_refund_operation as refund_operation
set stripe_payment_intent_id = payment_attempt.stripe_payment_intent_id
from ceaute.booking_payment_attempt as payment_attempt
where payment_attempt.id = refund_operation.booking_payment_attempt_id
  and refund_operation.stripe_payment_intent_id is null;

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
    and existing.id <> new.id;

  if new.expected_amount_pence > payment_attempt.amount_charged_pence
    or other_entitlement + new.expected_amount_pence > payment_attempt.amount_charged_pence then
    raise exception 'Total refund entitlement exceeds the captured amount.';
  end if;

  return new;
end;
$$;

drop trigger if exists booking_refund_operation_validate_entitlement
on ceaute.booking_refund_operation;
create trigger booking_refund_operation_validate_entitlement
before insert or update of booking_id, booking_payment_attempt_id,
  stripe_payment_intent_id, expected_amount_pence
on ceaute.booking_refund_operation
for each row execute function ceaute.validate_booking_refund_entitlement();

drop function if exists ceaute.claim_booking_refund_operation(uuid);

create function ceaute.claim_booking_refund_operation(
  target_refund_operation_id uuid
)
returns table (
  action text,
  refund_operation_id uuid,
  booking_id uuid,
  payment_attempt_id uuid,
  purpose text,
  expected_amount_pence bigint,
  captured_amount_pence bigint,
  idempotency_key text,
  stripe_refund_id text,
  stripe_payment_intent_id text,
  stripe_charge_id text,
  ceaute_fee_pence bigint,
  refund_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  refund_operation ceaute.booking_refund_operation%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  existing_entitlement bigint;
  next_action text;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

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

  select coalesce(sum(other.expected_amount_pence), 0)
  into existing_entitlement
  from ceaute.booking_refund_operation as other
  where other.stripe_payment_intent_id = payment_attempt.stripe_payment_intent_id;

  if payment_attempt.id is null
    or nullif(btrim(payment_attempt.stripe_payment_intent_id), '') is null
    or refund_operation.stripe_payment_intent_id is distinct from payment_attempt.stripe_payment_intent_id
    or refund_operation.expected_amount_pence > payment_attempt.amount_charged_pence
    or existing_entitlement > payment_attempt.amount_charged_pence then
    raise exception 'Refund operation is not valid for the captured payment.';
  end if;

  if refund_operation.status in ('succeeded', 'failed', 'cancelled', 'requires_review') then
    return query select
      'complete'::text, refund_operation.id, refund_operation.booking_id,
      refund_operation.booking_payment_attempt_id, refund_operation.purpose,
      refund_operation.expected_amount_pence, payment_attempt.amount_charged_pence,
      refund_operation.idempotency_key,
      refund_operation.stripe_refund_id, refund_operation.stripe_payment_intent_id,
      refund_operation.stripe_charge_id, payment_attempt.ceaute_fee_pence,
      refund_operation.status;
    return;
  end if;

  if refund_operation.status = 'processing'
    and refund_operation.processing_started_at > now() - interval '2 minutes' then
    return query select
      'processing'::text, refund_operation.id, refund_operation.booking_id,
      refund_operation.booking_payment_attempt_id, refund_operation.purpose,
      refund_operation.expected_amount_pence, payment_attempt.amount_charged_pence,
      refund_operation.idempotency_key,
      refund_operation.stripe_refund_id, refund_operation.stripe_payment_intent_id,
      refund_operation.stripe_charge_id, payment_attempt.ceaute_fee_pence,
      refund_operation.status;
    return;
  end if;

  if refund_operation.stripe_refund_id is null
    and refund_operation.create_attempted_at <= now() - interval '23 hours' then
    update ceaute.booking_refund_operation
    set status = 'requires_review',
        processing_started_at = null,
        requires_review_at = coalesce(requires_review_at, now()),
        failure_reason = 'Stripe refund creation could not be proven within the idempotency window.'
    where id = refund_operation.id
    returning * into refund_operation;

    update ceaute.booking_payment_attempt
    set payment_status = 'refund_required',
        failure_reason = 'Refund requires review before any further Stripe request.'
    where id = payment_attempt.id
      and payment_status <> 'refunded';

    return query select
      'requires_review'::text, refund_operation.id, refund_operation.booking_id,
      refund_operation.booking_payment_attempt_id, refund_operation.purpose,
      refund_operation.expected_amount_pence, payment_attempt.amount_charged_pence,
      refund_operation.idempotency_key,
      refund_operation.stripe_refund_id, refund_operation.stripe_payment_intent_id,
      refund_operation.stripe_charge_id, payment_attempt.ceaute_fee_pence,
      refund_operation.status;
    return;
  end if;

  next_action := case
    when refund_operation.stripe_refund_id is not null then 'reconcile'
    when refund_operation.create_attempted_at is not null then 'verify_before_retry'
    else 'create'
  end;

  update ceaute.booking_refund_operation
  set status = 'processing',
      processing_started_at = now(),
      last_attempt_at = now(),
      create_attempted_at = case
        when stripe_refund_id is null then coalesce(create_attempted_at, now())
        else create_attempted_at
      end,
      attempt_count = attempt_count + 1,
      failure_reason = null
  where id = refund_operation.id
  returning * into refund_operation;

  return query select
    next_action, refund_operation.id, refund_operation.booking_id,
    refund_operation.booking_payment_attempt_id, refund_operation.purpose,
    refund_operation.expected_amount_pence, payment_attempt.amount_charged_pence,
    refund_operation.idempotency_key,
    refund_operation.stripe_refund_id, refund_operation.stripe_payment_intent_id,
    refund_operation.stripe_charge_id, payment_attempt.ceaute_fee_pence,
    refund_operation.status;
end;
$$;

drop function if exists ceaute.record_booking_refund_state(uuid, text, text, bigint, text, text);

create function ceaute.record_booking_refund_state(
  target_refund_operation_id uuid,
  target_stripe_refund_id text,
  target_stripe_payment_intent_id text,
  target_stripe_charge_id text,
  target_amount_pence bigint,
  target_status text,
  target_failure_reason text default null,
  target_event_created_at bigint default null
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  refund_operation ceaute.booking_refund_operation%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  normalized_status text;
  event_created_at timestamptz;
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

  if event_created_at is not null
    and refund_operation.last_stripe_event_created_at is not null
    and event_created_at < refund_operation.last_stripe_event_created_at then
    return;
  end if;

  if refund_operation.status = 'succeeded'
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
        then left(coalesce(nullif(btrim(target_failure_reason), ''), 'Stripe refund failed.'), 500)
        else null end,
      processing_started_at = null,
      stripe_updated_at = now(),
      last_stripe_event_created_at = coalesce(event_created_at, last_stripe_event_created_at),
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
      refunded_at = case when normalized_status = 'succeeded' then coalesce(refunded_at, now()) else refunded_at end,
      refund_failed_at = case when normalized_status in ('failed', 'cancelled') then coalesce(refund_failed_at, now()) else null end,
      failure_reason = case
        when normalized_status in ('failed', 'cancelled')
          then left(coalesce(nullif(btrim(target_failure_reason), ''), 'Stripe refund failed.'), 500)
        when normalized_status = 'pending' then 'Stripe refund is pending.'
        else null
      end
  where id = payment_attempt.id;
end;
$$;

create or replace function ceaute.record_booking_refund_processing_outcome(
  target_refund_operation_id uuid,
  target_outcome text,
  target_failure_reason text
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt_id uuid;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if target_outcome not in ('pending', 'failed', 'requires_review') then
    raise exception 'Invalid refund processing outcome.';
  end if;

  update ceaute.booking_refund_operation
  set status = target_outcome,
      processing_started_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_failure_reason), ''), 'Refund processing failed.'), 500),
      failed_at = case when target_outcome = 'failed' then coalesce(failed_at, now()) else failed_at end,
      requires_review_at = case when target_outcome = 'requires_review'
        then coalesce(requires_review_at, now()) else requires_review_at end
  where id = target_refund_operation_id
    and status = 'processing'
  returning booking_payment_attempt_id into payment_attempt_id;

  if payment_attempt_id is null then
    raise exception 'Refund operation is not processing.';
  end if;

  update ceaute.booking_payment_attempt
  set payment_status = case when target_outcome = 'failed' then 'refund_failed' else 'refund_required' end,
      failure_reason = left(coalesce(nullif(btrim(target_failure_reason), ''), 'Refund processing failed.'), 500),
      refund_failed_at = case when target_outcome = 'failed' then coalesce(refund_failed_at, now()) else refund_failed_at end
  where id = payment_attempt_id
    and payment_status <> 'refunded';
end;
$$;

revoke all on function ceaute.validate_booking_refund_entitlement()
from public, anon, authenticated, service_role;
revoke all on function ceaute.claim_booking_refund_operation(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_refund_state(uuid, text, text, text, bigint, text, text, bigint)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_refund_processing_outcome(uuid, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_refund_retryable_failure(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_booking_refund_operation(uuid) to service_role;
grant execute on function ceaute.record_booking_refund_state(uuid, text, text, text, bigint, text, text, bigint)
to service_role;
grant execute on function ceaute.record_booking_refund_processing_outcome(uuid, text, text)
to service_role;

drop function if exists ceaute.record_booking_refund_retryable_failure(uuid, text);
