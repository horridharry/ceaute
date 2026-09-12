alter table ceaute.booking
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by text check (cancelled_by in ('customer', 'provider')),
  add column if not exists cancellation_refund_pence bigint check (cancellation_refund_pence is null or cancellation_refund_pence >= 0),
  add column if not exists cancellation_retained_pence bigint check (cancellation_retained_pence is null or cancellation_retained_pence >= 0);

alter table ceaute.booking_payment_attempt
  add column if not exists refund_amount_pence bigint check (refund_amount_pence is null or refund_amount_pence >= 0),
  add column if not exists retained_amount_pence bigint check (retained_amount_pence is null or retained_amount_pence >= 0),
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_failed_at timestamptz;

create or replace function ceaute.prepare_booking_cancellation(
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
  provider_stripe_account_id text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_booking ceaute.booking%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
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

  if cancellation_actor not in ('customer', 'provider') then
    raise exception 'Invalid cancellation actor.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = target_booking_id
  for update;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if cancellation_actor = 'customer'
    and target_booking.customer_profile_id <> current_profile_id then
    raise exception 'Booking not found.';
  end if;

  if cancellation_actor = 'provider'
    and not exists (
      select 1
      from ceaute.provider_page
      where provider_page.id = target_booking.provider_page_id
        and provider_page.owner_profile_id = current_profile_id
    ) then
    raise exception 'Booking not found.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where booking_payment_attempt.booking_id = target_booking.id
  for update;

  if target_booking.status = 'cancelled' then
    return query select
      'already_cancelled'::text,
      target_booking.id,
      payment_attempt.id,
      payment_attempt.stripe_payment_intent_id,
      coalesce(payment_attempt.amount_charged_pence, 0),
      coalesce(target_booking.cancellation_refund_pence, payment_attempt.refund_amount_pence, 0),
      coalesce(target_booking.cancellation_retained_pence, payment_attempt.retained_amount_pence, 0),
      coalesce(payment_attempt.ceaute_fee_pence, 0),
      payment_attempt.provider_stripe_account_id;
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
  cancellation_deadline :=
    target_booking.start_at - make_interval(hours => cancellation_window_hours);

  if cancellation_actor = 'customer' and now() >= cancellation_deadline then
    computed_retained_amount_pence := least(commitment_amount_pence, computed_amount_paid_pence);
  else
    computed_retained_amount_pence := 0;
  end if;

  computed_refund_amount_pence :=
    greatest(0, computed_amount_paid_pence - computed_retained_amount_pence);

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
    set payment_status = case
          when computed_refund_amount_pence > 0 then 'refund_required'
          else 'refunded'
        end,
        refund_amount_pence = computed_refund_amount_pence,
        retained_amount_pence = computed_retained_amount_pence,
        refund_requested_at = case
          when computed_refund_amount_pence > 0 then now()
          else refund_requested_at
        end,
        refunded_at = case
          when computed_refund_amount_pence = 0 then now()
          else refunded_at
        end,
        failure_reason = null
    where id = payment_attempt.id
    returning * into payment_attempt;
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
    payment_attempt.provider_stripe_account_id;
end;
$$;

revoke all on function ceaute.prepare_booking_cancellation(uuid, text)
from public, anon, authenticated;

grant execute on function ceaute.prepare_booking_cancellation(uuid, text)
to authenticated;

