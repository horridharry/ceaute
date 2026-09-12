-- Preserve every Checkout attempt and make creation a database-claimed operation.
alter table ceaute.booking_payment_attempt
  drop constraint if exists booking_payment_attempt_booking_id_key;

alter table ceaute.booking_payment_attempt
  drop constraint if exists booking_payment_attempt_payment_status_check;

alter table ceaute.booking_payment_attempt
  add column if not exists attempt_number integer,
  add column if not exists supersedes_payment_attempt_id uuid
    references ceaute.booking_payment_attempt (id) on delete restrict,
  add column if not exists checkout_claim_token uuid,
  add column if not exists checkout_claimed_at timestamptz,
  add column if not exists checkout_idempotency_key text,
  add column if not exists stripe_checkout_url text,
  add column if not exists stripe_checkout_expires_at timestamptz;

with numbered as (
  select id, row_number() over (partition by booking_id order by created_at, id)::integer as value
  from ceaute.booking_payment_attempt
)
update ceaute.booking_payment_attempt
set attempt_number = numbered.value,
    checkout_idempotency_key = coalesce(
      checkout_idempotency_key,
      'ceaute-checkout-' || booking_payment_attempt.id::text
    )
from numbered
where numbered.id = booking_payment_attempt.id;

alter table ceaute.booking_payment_attempt
  alter column attempt_number set not null,
  alter column checkout_idempotency_key set not null,
  add constraint booking_payment_attempt_payment_status_check check (
    payment_status in (
      'created',
      'checkout_creating',
      'checkout_created',
      'expired',
      'succeeded',
      'duplicate_paid',
      'failed',
      'cancelled',
      'refund_required',
      'refunded',
      'refund_failed'
    )
  ),
  add constraint booking_payment_attempt_booking_attempt_number_key
    unique (booking_id, attempt_number),
  add constraint booking_payment_attempt_checkout_idempotency_key_key
    unique (checkout_idempotency_key);

create unique index booking_payment_attempt_one_active_checkout
on ceaute.booking_payment_attempt (booking_id)
where payment_status in ('created', 'checkout_creating', 'checkout_created');

alter table ceaute.booking
  add column if not exists confirming_payment_attempt_id uuid
    references ceaute.booking_payment_attempt (id) on delete restrict;

update ceaute.booking
set confirming_payment_attempt_id = (
  select booking_payment_attempt.id
  from ceaute.booking_payment_attempt
  where booking_payment_attempt.booking_id = booking.id
    and booking_payment_attempt.payment_status = 'succeeded'
  order by booking_payment_attempt.created_at, booking_payment_attempt.id
  limit 1
)
where booking.confirmed_at is not null
  and booking.confirming_payment_attempt_id is null;

create table ceaute.booking_refund_operation (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references ceaute.booking (id) on delete restrict,
  booking_payment_attempt_id uuid not null
    references ceaute.booking_payment_attempt (id) on delete restrict,
  purpose text not null check (purpose in ('cancellation', 'late_payment', 'duplicate_payment')),
  expected_amount_pence bigint not null check (expected_amount_pence > 0),
  idempotency_key text not null unique,
  stripe_refund_id text unique,
  status text not null default 'requested' check (
    status in ('requested', 'processing', 'pending', 'succeeded', 'failed', 'cancelled')
  ),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  failure_reason text,
  processing_started_at timestamptz,
  last_attempt_at timestamptz,
  stripe_updated_at timestamptz,
  succeeded_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_payment_attempt_id, purpose)
);

create trigger booking_refund_operation_set_updated_at
before update on ceaute.booking_refund_operation
for each row execute function ceaute.set_updated_at();

alter table ceaute.booking_refund_operation enable row level security;
revoke all on ceaute.booking_refund_operation from public, anon, authenticated, service_role;

create or replace function ceaute.claim_booking_checkout(
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
    or nullif(btrim(target_provider_stripe_account_id), '') is null then
    raise exception 'Invalid authoritative payment amounts.';
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
      'terminal'::text,
      successful_attempt.id,
      null::uuid,
      successful_attempt.checkout_idempotency_key,
      successful_attempt.stripe_checkout_session_id,
      successful_attempt.stripe_checkout_url,
      successful_attempt.stripe_checkout_expires_at,
      successful_attempt.payment_status;
    return;
  end if;

  if target_booking.status <> 'awaiting_payment' or target_booking.expires_at <= now() then
    return query select
      'booking_unavailable'::text,
      null::uuid, null::uuid, null::text, null::text, null::text, null::timestamptz,
      target_booking.status;
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
        'reuse'::text,
        active_attempt.id,
        null::uuid,
        active_attempt.checkout_idempotency_key,
        active_attempt.stripe_checkout_session_id,
        active_attempt.stripe_checkout_url,
        active_attempt.stripe_checkout_expires_at,
        active_attempt.payment_status;
      return;
    end if;

    if active_attempt.payment_status = 'checkout_creating'
      and active_attempt.checkout_claimed_at > now() - interval '2 minutes' then
      return query select
        'processing'::text,
        active_attempt.id,
        null::uuid,
        active_attempt.checkout_idempotency_key,
        active_attempt.stripe_checkout_session_id,
        active_attempt.stripe_checkout_url,
        active_attempt.stripe_checkout_expires_at,
        active_attempt.payment_status;
      return;
    end if;

    update ceaute.booking_payment_attempt
    set payment_status = 'checkout_creating',
        checkout_claim_token = new_claim_token,
        checkout_claimed_at = now(),
        failure_reason = null
    where id = active_attempt.id
    returning * into active_attempt;
  else
    select coalesce(max(attempt_number), 0) + 1 into next_attempt_number
    from ceaute.booking_payment_attempt
    where booking_id = target_booking.id;

    insert into ceaute.booking_payment_attempt (
      id,
      booking_id,
      attempt_number,
      amount_charged_pence,
      total_booking_value_pence,
      amount_due_later_pence,
      ceaute_fee_pence,
      currency,
      payment_status,
      provider_stripe_account_id,
      checkout_claim_token,
      checkout_claimed_at,
      checkout_idempotency_key
    ) values (
      new_attempt_id,
      target_booking.id,
      next_attempt_number,
      target_amount_charged_pence,
      target_total_booking_value_pence,
      target_amount_due_later_pence,
      target_ceaute_fee_pence,
      lower(target_currency),
      'checkout_creating',
      target_provider_stripe_account_id,
      new_claim_token,
      now(),
      'ceaute-checkout-' || new_attempt_id::text
    )
    returning * into active_attempt;
  end if;

  return query select
    'create'::text,
    active_attempt.id,
    active_attempt.checkout_claim_token,
    active_attempt.checkout_idempotency_key,
    active_attempt.stripe_checkout_session_id,
    active_attempt.stripe_checkout_url,
    active_attempt.stripe_checkout_expires_at,
    active_attempt.payment_status;
end;
$$;

create or replace function ceaute.release_booking_checkout_claim(
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
  set payment_status = 'created',
      checkout_claim_token = null,
      checkout_claimed_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_reason), ''), 'Checkout creation failed.'), 500)
  where id = target_payment_attempt_id
    and checkout_claim_token = target_claim_token
    and payment_status = 'checkout_creating'
    and stripe_checkout_session_id is null;

  if not found then
    raise exception 'Checkout claim is no longer active.';
  end if;
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

  if payment_attempt.id is null
    or payment_attempt.payment_status <> 'checkout_creating'
    or payment_attempt.checkout_claim_token is distinct from target_claim_token then
    raise exception 'Checkout claim is no longer active.';
  end if;

  if payment_attempt.stripe_checkout_session_id is not null
    or payment_attempt.stripe_payment_intent_id is not null then
    raise exception 'Stripe payment identifiers cannot be replaced.';
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
end;
$$;

create or replace function ceaute.replace_expired_checkout_attempt(
  target_payment_attempt_id uuid
)
returns table (
  payment_attempt_id uuid,
  claim_token uuid,
  checkout_idempotency_key text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  old_attempt ceaute.booking_payment_attempt%rowtype;
  new_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
  new_claim_token uuid := gen_random_uuid();
  new_attempt_id uuid := gen_random_uuid();
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into old_attempt
  from ceaute.booking_payment_attempt
  where id = target_payment_attempt_id
  for update;

  if old_attempt.id is null then
    raise exception 'Payment attempt not found.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = old_attempt.booking_id
  for update;

  if target_booking.status <> 'awaiting_payment' or target_booking.expires_at <= now() then
    raise exception 'Booking is no longer payable.';
  end if;

  if old_attempt.payment_status <> 'checkout_created'
    or old_attempt.stripe_checkout_expires_at is null
    or old_attempt.stripe_checkout_expires_at > now() then
    raise exception 'Checkout session is not expired.';
  end if;

  update ceaute.booking_payment_attempt
  set payment_status = 'expired',
      failure_reason = 'Checkout session expired.'
  where id = old_attempt.id;

  insert into ceaute.booking_payment_attempt (
    id,
    booking_id,
    attempt_number,
    supersedes_payment_attempt_id,
    amount_charged_pence,
    total_booking_value_pence,
    amount_due_later_pence,
    ceaute_fee_pence,
    currency,
    payment_status,
    provider_stripe_account_id,
    checkout_claim_token,
    checkout_claimed_at,
    checkout_idempotency_key
  ) values (
    new_attempt_id,
    old_attempt.booking_id,
    old_attempt.attempt_number + 1,
    old_attempt.id,
    old_attempt.amount_charged_pence,
    old_attempt.total_booking_value_pence,
    old_attempt.amount_due_later_pence,
    old_attempt.ceaute_fee_pence,
    old_attempt.currency,
    'checkout_creating',
    old_attempt.provider_stripe_account_id,
    new_claim_token,
    now(),
    'ceaute-checkout-' || new_attempt_id::text
  )
  returning * into new_attempt;

  return query select new_attempt.id, new_attempt.checkout_claim_token, new_attempt.checkout_idempotency_key;
end;
$$;

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
    and payment_attempt.stripe_payment_intent_id is distinct from target_stripe_payment_intent_id then
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
end;
$$;

drop function if exists ceaute.complete_booking_payment_attempt(uuid, text, text);

create function ceaute.complete_booking_payment_attempt(
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
      'already_processed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence,
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
      'confirmed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  if target_booking.status in ('confirmed', 'completed')
    and target_booking.confirming_payment_attempt_id = payment_attempt.id then
    update ceaute.booking_payment_attempt
    set payment_status = 'succeeded', failure_reason = null
    where id = payment_attempt.id;

    return query select
      'already_processed'::text,
      payment_attempt.booking_id,
      payment_attempt.amount_charged_pence,
      payment_attempt.ceaute_fee_pence,
      null::uuid;
    return;
  end if;

  insert into ceaute.booking_refund_operation (
    booking_id,
    booking_payment_attempt_id,
    purpose,
    expected_amount_pence,
    idempotency_key
  ) values (
    payment_attempt.booking_id,
    payment_attempt.id,
    case when target_booking.status in ('confirmed', 'completed')
      then 'duplicate_payment' else 'late_payment' end,
    payment_attempt.amount_charged_pence,
    'ceaute-refund-' ||
      case when target_booking.status in ('confirmed', 'completed')
        then 'duplicate-payment-' else 'late-payment-' end ||
      payment_attempt.id::text
  )
  on conflict (booking_payment_attempt_id, purpose) do update
    set updated_at = booking_refund_operation.updated_at
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

drop function if exists ceaute.prepare_booking_cancellation(uuid, text);

create function ceaute.prepare_booking_cancellation(
  target_booking_id uuid,
  cancellation_actor text
)
returns table (
  outcome text,
  booking_id uuid,
  payment_attempt_id uuid,
  stripe_payment_intent_id text,
  amount_paid_pence bigint,
  refund_amount_pence bigint,
  retained_amount_pence bigint,
  ceaute_fee_pence bigint,
  provider_stripe_account_id text,
  refund_operation_id uuid,
  refund_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_booking ceaute.booking%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  refund_operation ceaute.booking_refund_operation%rowtype;
  cancellation_window_hours integer;
  cancellation_deadline timestamptz;
  commitment_amount_pence bigint;
  computed_amount_paid_pence bigint := 0;
  computed_refund_amount_pence bigint := 0;
  computed_retained_amount_pence bigint := 0;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  case cancellation_actor
    when 'customer' then
      select booking.* into target_booking
      from ceaute.booking
      where booking.id = target_booking_id
        and booking.customer_profile_id = current_profile_id
      for update;
    when 'provider' then
      select booking.* into target_booking
      from ceaute.booking
      join ceaute.provider_page on provider_page.id = booking.provider_page_id
      where booking.id = target_booking_id
        and provider_page.owner_profile_id = current_profile_id
      for update of booking;
    else
      raise exception 'Invalid cancellation actor.';
  end case;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if target_booking.confirming_payment_attempt_id is not null then
    select * into payment_attempt
    from ceaute.booking_payment_attempt
    where id = target_booking.confirming_payment_attempt_id
    for update;
  else
    select * into payment_attempt
    from ceaute.booking_payment_attempt
    where booking_id = target_booking.id
      and payment_status in ('succeeded', 'refund_required', 'refunded', 'refund_failed')
    order by attempt_number desc
    limit 1
    for update;
  end if;

  if target_booking.status = 'cancelled' then
    if payment_attempt.id is not null then
      select * into refund_operation
      from ceaute.booking_refund_operation
      where booking_payment_attempt_id = payment_attempt.id
        and purpose = 'cancellation';
    end if;

    return query select
      'already_cancelled'::text,
      target_booking.id,
      payment_attempt.id,
      payment_attempt.stripe_payment_intent_id,
      coalesce(payment_attempt.amount_charged_pence, 0),
      coalesce(target_booking.cancellation_refund_pence, payment_attempt.refund_amount_pence, 0),
      coalesce(target_booking.cancellation_retained_pence, payment_attempt.retained_amount_pence, 0),
      coalesce(payment_attempt.ceaute_fee_pence, 0),
      payment_attempt.provider_stripe_account_id,
      refund_operation.id,
      refund_operation.status;
    return;
  end if;

  if target_booking.status = 'completed' then
    raise exception 'Completed bookings cannot be cancelled.';
  end if;

  if target_booking.status <> 'confirmed' then
    raise exception 'Only confirmed bookings can be cancelled.';
  end if;

  if target_booking.start_at <= now() then
    raise exception 'Past bookings cannot be cancelled.';
  end if;

  if payment_attempt.id is not null
    and payment_attempt.payment_status not in ('succeeded', 'refunded', 'refund_required', 'refund_failed') then
    raise exception 'Booking payment is not complete.';
  end if;

  computed_amount_paid_pence := coalesce(payment_attempt.amount_charged_pence, 0);
  cancellation_window_hours :=
    coalesce(nullif(target_booking.service_snapshot ->> 'cancellation_window_hours', '')::integer, 24);
  commitment_amount_pence :=
    greatest(0, coalesce(nullif(target_booking.service_snapshot ->> 'commitment_amount_pence', '')::bigint, 0));
  cancellation_deadline := target_booking.start_at - make_interval(hours => cancellation_window_hours);

  if cancellation_actor = 'customer' and now() >= cancellation_deadline then
    computed_retained_amount_pence := least(commitment_amount_pence, computed_amount_paid_pence);
  end if;

  computed_refund_amount_pence := greatest(0, computed_amount_paid_pence - computed_retained_amount_pence);

  update ceaute.booking
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = cancellation_actor,
      cancellation_refund_pence = computed_refund_amount_pence,
      cancellation_retained_pence = computed_retained_amount_pence
  where id = target_booking.id
  returning * into target_booking;

  if payment_attempt.id is not null then
    update ceaute.booking_payment_attempt
    set payment_status = case when computed_refund_amount_pence > 0 then 'refund_required' else 'refunded' end,
        refund_amount_pence = computed_refund_amount_pence,
        retained_amount_pence = computed_retained_amount_pence,
        refund_requested_at = case when computed_refund_amount_pence > 0 then now() else refund_requested_at end,
        refunded_at = case when computed_refund_amount_pence = 0 then now() else refunded_at end,
        failure_reason = null
    where id = payment_attempt.id
    returning * into payment_attempt;
  end if;

  if computed_refund_amount_pence > 0 and payment_attempt.id is not null then
    insert into ceaute.booking_refund_operation (
      booking_id,
      booking_payment_attempt_id,
      purpose,
      expected_amount_pence,
      idempotency_key
    ) values (
      target_booking.id,
      payment_attempt.id,
      'cancellation',
      computed_refund_amount_pence,
      'ceaute-refund-cancellation-' || payment_attempt.id::text
    )
    on conflict (booking_payment_attempt_id, purpose) do update
      set updated_at = booking_refund_operation.updated_at
    returning * into refund_operation;
  end if;

  return query select
    'cancelled'::text,
    target_booking.id,
    payment_attempt.id,
    payment_attempt.stripe_payment_intent_id,
    computed_amount_paid_pence,
    computed_refund_amount_pence,
    computed_retained_amount_pence,
    coalesce(payment_attempt.ceaute_fee_pence, 0),
    payment_attempt.provider_stripe_account_id,
    refund_operation.id,
    refund_operation.status;
end;
$$;

create or replace function ceaute.claim_booking_refund_operation(
  target_refund_operation_id uuid
)
returns table (
  action text,
  refund_operation_id uuid,
  booking_id uuid,
  payment_attempt_id uuid,
  purpose text,
  expected_amount_pence bigint,
  idempotency_key text,
  stripe_refund_id text,
  stripe_payment_intent_id text,
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

  if payment_attempt.id is null
    or nullif(btrim(payment_attempt.stripe_payment_intent_id), '') is null
    or refund_operation.expected_amount_pence > payment_attempt.amount_charged_pence then
    raise exception 'Refund operation is not valid for the captured payment.';
  end if;

  if refund_operation.status = 'succeeded' then
    return query select
      'complete'::text, refund_operation.id, refund_operation.booking_id,
      refund_operation.booking_payment_attempt_id, refund_operation.purpose,
      refund_operation.expected_amount_pence, refund_operation.idempotency_key,
      refund_operation.stripe_refund_id, payment_attempt.stripe_payment_intent_id,
      payment_attempt.ceaute_fee_pence, refund_operation.status;
    return;
  end if;

  if refund_operation.status = 'processing'
    and refund_operation.processing_started_at > now() - interval '2 minutes' then
    return query select
      'processing'::text, refund_operation.id, refund_operation.booking_id,
      refund_operation.booking_payment_attempt_id, refund_operation.purpose,
      refund_operation.expected_amount_pence, refund_operation.idempotency_key,
      refund_operation.stripe_refund_id, payment_attempt.stripe_payment_intent_id,
      payment_attempt.ceaute_fee_pence, refund_operation.status;
    return;
  end if;

  update ceaute.booking_refund_operation
  set status = 'processing',
      processing_started_at = now(),
      last_attempt_at = now(),
      attempt_count = attempt_count + 1,
      failure_reason = null
  where id = refund_operation.id
  returning * into refund_operation;

  return query select
    case when refund_operation.stripe_refund_id is null then 'create'::text else 'reconcile'::text end,
    refund_operation.id, refund_operation.booking_id,
    refund_operation.booking_payment_attempt_id, refund_operation.purpose,
    refund_operation.expected_amount_pence, refund_operation.idempotency_key,
    refund_operation.stripe_refund_id, payment_attempt.stripe_payment_intent_id,
    payment_attempt.ceaute_fee_pence, refund_operation.status;
end;
$$;

create or replace function ceaute.record_booking_refund_state(
  target_refund_operation_id uuid,
  target_stripe_refund_id text,
  target_stripe_payment_intent_id text,
  target_amount_pence bigint,
  target_status text,
  target_failure_reason text default null
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
    or payment_attempt.stripe_payment_intent_id is distinct from target_stripe_payment_intent_id
    or refund_operation.expected_amount_pence is distinct from target_amount_pence
    or (refund_operation.stripe_refund_id is not null
      and refund_operation.stripe_refund_id <> target_stripe_refund_id) then
    raise exception 'Stripe refund does not match the persisted refund operation.';
  end if;

  update ceaute.booking_refund_operation
  set stripe_refund_id = target_stripe_refund_id,
      status = normalized_status,
      failure_reason = case when normalized_status in ('failed', 'cancelled')
        then left(coalesce(nullif(btrim(target_failure_reason), ''), 'Stripe refund failed.'), 500)
        else null end,
      processing_started_at = null,
      stripe_updated_at = now(),
      succeeded_at = case when normalized_status = 'succeeded' then coalesce(succeeded_at, now()) else succeeded_at end,
      failed_at = case when normalized_status = 'failed' then now() else failed_at end,
      cancelled_at = case when normalized_status = 'cancelled' then now() else cancelled_at end
  where id = refund_operation.id;

  update ceaute.booking_payment_attempt
  set stripe_refund_id = target_stripe_refund_id,
      payment_status = case
        when normalized_status = 'succeeded' then 'refunded'
        when normalized_status in ('failed', 'cancelled') then 'refund_failed'
        else 'refund_required'
      end,
      refunded_at = case when normalized_status = 'succeeded' then coalesce(refunded_at, now()) else refunded_at end,
      refund_failed_at = case when normalized_status in ('failed', 'cancelled') then now() else null end,
      failure_reason = case
        when normalized_status in ('failed', 'cancelled')
          then left(coalesce(nullif(btrim(target_failure_reason), ''), 'Stripe refund failed.'), 500)
        when normalized_status = 'pending' then 'Stripe refund is pending.'
        else null
      end
  where id = payment_attempt.id;
end;
$$;

create or replace function ceaute.record_booking_refund_retryable_failure(
  target_refund_operation_id uuid,
  target_failure_reason text
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
  set status = 'failed',
      processing_started_at = null,
      failure_reason = left(coalesce(nullif(btrim(target_failure_reason), ''), 'Refund processing failed.'), 500),
      failed_at = now()
  where id = target_refund_operation_id
    and status = 'processing';

  if not found then
    raise exception 'Refund operation is not processing.';
  end if;
end;
$$;

revoke all on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.release_booking_checkout_claim(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
from public, anon, authenticated, service_role;
revoke all on function ceaute.replace_expired_checkout_attempt(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
from public, anon, authenticated, service_role;
revoke all on function ceaute.complete_booking_payment_attempt(uuid, text, text, text, text, bigint)
from public, anon, authenticated, service_role;
revoke all on function ceaute.prepare_booking_cancellation(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.claim_booking_refund_operation(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_refund_state(uuid, text, text, bigint, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_refund_retryable_failure(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_booking_checkout(uuid, bigint, bigint, bigint, bigint, text, text)
to service_role;
grant execute on function ceaute.release_booking_checkout_claim(uuid, uuid, text)
to service_role;
grant execute on function ceaute.record_booking_checkout_session(uuid, uuid, text, text, text, timestamptz)
to service_role;
grant execute on function ceaute.replace_expired_checkout_attempt(uuid)
to service_role;
grant execute on function ceaute.mark_booking_payment_attempt_failed(uuid, text, text, text, boolean)
to service_role;
grant execute on function ceaute.complete_booking_payment_attempt(uuid, text, text, text, text, bigint)
to service_role;
grant execute on function ceaute.prepare_booking_cancellation(uuid, text)
to authenticated;
grant execute on function ceaute.claim_booking_refund_operation(uuid)
to service_role;
grant execute on function ceaute.record_booking_refund_state(uuid, text, text, bigint, text, text)
to service_role;
grant execute on function ceaute.record_booking_refund_retryable_failure(uuid, text)
to service_role;
