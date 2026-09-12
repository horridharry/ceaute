create or replace function ceaute.redact_booking_private_location(
  snapshot jsonb
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(snapshot, '{}'::jsonb)
    - 'address_line_1'
    - 'address_line_2'
    - 'city'
    - 'postcode'
    - 'access_instructions';
$$;

revoke all on function ceaute.redact_booking_private_location(jsonb)
from public, anon, authenticated, service_role;

-- Booking snapshots contain private location data. Client roles must use the
-- purpose-built summary functions below instead of selecting the table.
revoke all on table ceaute.booking from anon, authenticated;

drop policy if exists booking_select_confirmed_provider_or_customer
on ceaute.booking;

create policy booking_select_paid_detail_participant
on ceaute.booking
for select
to authenticated
using (
  confirmed_at is not null
  and (status = 'confirmed' or status = 'completed')
  and (
    customer_profile_id = (select auth.uid())
    or exists (
      select 1
      from ceaute.provider_page
      where provider_page.id = booking.provider_page_id
        and provider_page.owner_profile_id = (select auth.uid())
    )
  )
);

drop function if exists ceaute.get_booking_hold_summary(uuid);

create function ceaute.get_booking_hold_summary(
  target_booking_id uuid
)
returns table (
  id uuid,
  status text,
  start_at timestamptz,
  end_at timestamptz,
  expires_at timestamptz,
  confirmed_at timestamptz,
  customer_snapshot jsonb,
  service_snapshot jsonb
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  update ceaute.booking
  set status = 'cancelled'
  where booking.id = target_booking_id
    and booking.status = 'awaiting_payment'
    and booking.expires_at <= now();

  return query
  select
    booking.id,
    booking.status,
    booking.start_at,
    booking.end_at,
    booking.expires_at,
    booking.confirmed_at,
    booking.customer_snapshot,
    case
      when booking.confirmed_at is not null
        and (booking.status = 'confirmed' or booking.status = 'completed')
      then booking.service_snapshot
      else ceaute.redact_booking_private_location(booking.service_snapshot)
    end
  from ceaute.booking
  where booking.id = target_booking_id
    and (
      booking.customer_profile_id = auth.uid()
      or exists (
        select 1
        from ceaute.provider_page
        where provider_page.id = booking.provider_page_id
          and provider_page.owner_profile_id = auth.uid()
      )
    );
end;
$$;

create or replace function ceaute.get_customer_booking_summaries(
  target_booking_id uuid default null
)
returns table (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_refund_pence bigint,
  cancellation_retained_pence bigint,
  customer_snapshot jsonb,
  service_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = ceaute, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  return query
  select
    booking.id,
    booking.start_at,
    booking.end_at,
    booking.status,
    booking.confirmed_at,
    booking.cancelled_at,
    booking.cancelled_by,
    booking.cancellation_refund_pence,
    booking.cancellation_retained_pence,
    booking.customer_snapshot,
    case
      when target_booking_id is not null
        and booking.confirmed_at is not null
        and (booking.status = 'confirmed' or booking.status = 'completed')
      then booking.service_snapshot
      else ceaute.redact_booking_private_location(booking.service_snapshot)
    end
  from ceaute.booking
  where booking.customer_profile_id = auth.uid()
    and (target_booking_id is null or booking.id = target_booking_id)
  order by booking.start_at;
end;
$$;

create or replace function ceaute.get_provider_booking_summaries(
  target_booking_id uuid default null
)
returns table (
  id uuid,
  start_at timestamptz,
  end_at timestamptz,
  status text,
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by text,
  cancellation_refund_pence bigint,
  cancellation_retained_pence bigint,
  customer_snapshot jsonb,
  service_snapshot jsonb
)
language plpgsql
stable
security definer
set search_path = ceaute, public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  return query
  select
    booking.id,
    booking.start_at,
    booking.end_at,
    booking.status,
    booking.confirmed_at,
    booking.cancelled_at,
    booking.cancelled_by,
    booking.cancellation_refund_pence,
    booking.cancellation_retained_pence,
    booking.customer_snapshot,
    case
      when target_booking_id is not null
        and booking.confirmed_at is not null
        and (booking.status = 'confirmed' or booking.status = 'completed')
      then booking.service_snapshot
      else ceaute.redact_booking_private_location(booking.service_snapshot)
    end
  from ceaute.booking
  join ceaute.provider_page
    on provider_page.id = booking.provider_page_id
  where provider_page.owner_profile_id = auth.uid()
    and (target_booking_id is null or booking.id = target_booking_id)
  order by booking.start_at;
end;
$$;

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
      join ceaute.provider_page
        on provider_page.id = booking.provider_page_id
      where booking.id = target_booking_id
        and provider_page.owner_profile_id = current_profile_id
      for update of booking;
    else
      raise exception 'Invalid cancellation actor.';
  end case;

  if target_booking.id is null then
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
    and not (
      payment_attempt.payment_status = 'succeeded'
      or payment_attempt.payment_status = 'refunded'
      or payment_attempt.payment_status = 'refund_required'
      or payment_attempt.payment_status = 'refund_failed'
    ) then
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

revoke all on function ceaute.get_booking_hold_summary(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_customer_booking_summaries(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.get_provider_booking_summaries(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.prepare_booking_cancellation(uuid, text)
from public, anon, authenticated;

grant execute on function ceaute.get_booking_hold_summary(uuid)
to authenticated;
grant execute on function ceaute.get_customer_booking_summaries(uuid)
to authenticated;
grant execute on function ceaute.get_provider_booking_summaries(uuid)
to authenticated;
grant execute on function ceaute.prepare_booking_cancellation(uuid, text)
to authenticated;
