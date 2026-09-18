-- Carries the cancelling actor through to the refund settlement, and records
-- the application-fee refund that settles it.
--
-- Deliberately additive. `claim_booking_refund_operation` is long, load-bearing
-- and already has two "fix name resolution" migrations behind it, so rather
-- than redefine it to return four more columns, the settlement inputs are read
-- through a small function of their own. Nothing about claiming, leasing or
-- reconciling a refund changes.
--
-- No new state describes who cancelled: `booking.cancelled_by` and
-- `booking.cancelled_at` already record it, and lateness is derived from the
-- cancellation window in the booking's own snapshot.

alter table ceaute.booking_refund_operation
  add column application_fee_refund_pence bigint
    check (application_fee_refund_pence is null or application_fee_refund_pence >= 0),
  add column stripe_application_fee_refund_id text,
  add column application_fee_refunded_at timestamptz;

-- Everything the canonical settlement rules in
-- src/lib/payments/settlement-rules.js need, and nothing else. The rates and
-- the policy live in JavaScript so there is one source of truth; this function
-- only reports facts PostgreSQL already holds.
create function ceaute.get_booking_refund_settlement_inputs(
  target_refund_operation_id uuid
)
returns table (
  out_purpose text,
  out_amount_charged_pence bigint,
  out_application_fee_pence bigint,
  out_refund_amount_pence bigint,
  out_cancelled_by text,
  out_cancelled_late boolean,
  out_application_fee_refunded boolean
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  refund_operation ceaute.booking_refund_operation%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
  cancellation_window_hours integer;
  cancellation_deadline timestamptz;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into refund_operation
  from ceaute.booking_refund_operation
  where id = target_refund_operation_id;

  if refund_operation.id is null then
    raise exception 'Refund operation not found.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where id = refund_operation.booking_payment_attempt_id;

  select * into target_booking
  from ceaute.booking
  where id = refund_operation.booking_id;

  cancellation_window_hours :=
    coalesce(nullif(target_booking.service_snapshot ->> 'cancellation_window_hours', '')::integer, 24);
  cancellation_deadline :=
    target_booking.start_at - make_interval(hours => cancellation_window_hours);

  return query select
    refund_operation.purpose,
    coalesce(payment_attempt.amount_charged_pence, 0),
    coalesce(payment_attempt.ceaute_fee_pence, 0),
    coalesce(refund_operation.expected_amount_pence, 0),
    target_booking.cancelled_by,
    -- Late means the customer cancelled at or after their own deadline. A
    -- provider cancelling late is still a provider cancellation; the deadline
    -- belongs to the customer.
    (target_booking.cancelled_at is not null
      and target_booking.cancelled_at >= cancellation_deadline),
    refund_operation.application_fee_refunded_at is not null;
end;
$$;

-- Records the second Stripe call. Set once: a replay under the same
-- idempotency key returns the same Stripe object and must not move the
-- timestamp or double-count the amount.
create function ceaute.record_booking_application_fee_refund(
  target_refund_operation_id uuid,
  target_stripe_application_fee_refund_id text,
  target_amount_pence bigint
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

  update ceaute.booking_refund_operation
  set application_fee_refund_pence =
        coalesce(application_fee_refund_pence, greatest(0, coalesce(target_amount_pence, 0))),
      stripe_application_fee_refund_id =
        coalesce(stripe_application_fee_refund_id, nullif(btrim(target_stripe_application_fee_refund_id), '')),
      application_fee_refunded_at = coalesce(application_fee_refunded_at, now())
  where id = target_refund_operation_id;

  if not found then
    raise exception 'Refund operation not found.';
  end if;
end;
$$;

-- --- disputes ---------------------------------------------------------------

-- Who carries a lost dispute. Nobody until a person decides: assuming the
-- provider is at fault would be Ceaute insuring itself by default.
alter table ceaute.booking_dispute
  add column responsibility text not null default 'undetermined'
    check (responsibility in ('undetermined', 'provider', 'ceaute')),
  add column responsibility_note text,
  add column responsibility_decided_at timestamptz;

create function ceaute.set_booking_dispute_responsibility(
  target_stripe_dispute_id text,
  target_responsibility text,
  target_note text default null
)
returns table (
  out_stripe_dispute_id text,
  out_responsibility text,
  out_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  dispute ceaute.booking_dispute%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if target_responsibility not in ('undetermined', 'provider', 'ceaute') then
    raise exception 'Unknown dispute responsibility: %', target_responsibility;
  end if;

  update ceaute.booking_dispute
  set responsibility = target_responsibility,
      responsibility_note = nullif(btrim(target_note), ''),
      responsibility_decided_at =
        case when target_responsibility = 'undetermined' then null else now() end
  where stripe_dispute_id = target_stripe_dispute_id
  returning * into dispute;

  if dispute.id is null then
    raise exception 'Dispute not found.';
  end if;

  return query select dispute.stripe_dispute_id, dispute.responsibility, dispute.status;
end;
$$;

-- The listing gains the evidence an operator needs to answer a dispute: what
-- was agreed, when it was confirmed, whether it was cancelled and by whom, and
-- what the customer was shown before paying. Still no customer contact details.
drop function if exists ceaute.list_booking_disputes(boolean, integer);

create function ceaute.list_booking_disputes(
  include_closed boolean default false,
  max_disputes integer default 100
)
returns table (
  stripe_dispute_id text,
  booking_id uuid,
  status text,
  reason text,
  responsibility text,
  responsibility_note text,
  amount_pence bigint,
  currency text,
  evidence_due_at timestamptz,
  funds_withdrawn_at timestamptz,
  funds_reinstated_at timestamptz,
  closed_at timestamptz,
  opened_at timestamptz,
  last_event_at timestamptz,
  stripe_payment_intent_id text,
  provider_username text,
  treatment_name text,
  appointment_at timestamptz,
  booking_status text,
  booking_confirmed_at timestamptz,
  booking_cancelled_at timestamptz,
  booking_cancelled_by text,
  amount_charged_pence bigint,
  application_fee_pence bigint,
  cancellation_window_hours integer,
  written_policy text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  return query
  select
    booking_dispute.stripe_dispute_id,
    booking_dispute.booking_id,
    booking_dispute.status,
    booking_dispute.reason,
    booking_dispute.responsibility,
    booking_dispute.responsibility_note,
    booking_dispute.amount_pence,
    booking_dispute.currency,
    booking_dispute.evidence_due_at,
    booking_dispute.funds_withdrawn_at,
    booking_dispute.funds_reinstated_at,
    booking_dispute.closed_at,
    booking_dispute.opened_at,
    booking_dispute.last_event_at,
    booking_dispute.stripe_payment_intent_id,
    -- provider_page.username is varchar(30); RETURN QUERY rejects the row
    -- outright unless it matches the declared text column exactly.
    provider_page.username::text,
    booking.service_snapshot ->> 'treatment_name',
    booking.start_at,
    booking.status,
    booking.confirmed_at,
    booking.cancelled_at,
    booking.cancelled_by,
    booking_payment_attempt.amount_charged_pence,
    booking_payment_attempt.ceaute_fee_pence,
    nullif(booking.service_snapshot ->> 'cancellation_window_hours', '')::integer,
    booking.service_snapshot ->> 'written_policy'
  from ceaute.booking_dispute
  left join ceaute.booking on booking.id = booking_dispute.booking_id
  left join ceaute.provider_page on provider_page.id = booking.provider_page_id
  left join ceaute.booking_payment_attempt
    on booking_payment_attempt.id = booking_dispute.booking_payment_attempt_id
  where include_closed or booking_dispute.closed_at is null
  order by booking_dispute.evidence_due_at nulls last, booking_dispute.last_event_at desc
  limit greatest(1, least(coalesce(max_disputes, 100), 500));
end;
$$;

revoke all on function ceaute.get_booking_refund_settlement_inputs(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_application_fee_refund(uuid, text, bigint)
from public, anon, authenticated, service_role;
revoke all on function ceaute.set_booking_dispute_responsibility(text, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.list_booking_disputes(boolean, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.get_booking_refund_settlement_inputs(uuid) to service_role;
grant execute on function ceaute.record_booking_application_fee_refund(uuid, text, bigint) to service_role;
grant execute on function ceaute.set_booking_dispute_responsibility(text, text, text) to service_role;
grant execute on function ceaute.list_booking_disputes(boolean, integer) to service_role;
