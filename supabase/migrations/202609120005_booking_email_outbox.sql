create table ceaute.booking_email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (
    event_type in (
      'booking_confirmed_customer',
      'booking_confirmed_provider',
      'customer_cancelled_customer',
      'customer_cancelled_provider',
      'provider_cancelled_customer',
      'provider_cancelled_provider'
    )
  ),
  booking_id uuid not null references ceaute.booking (id) on delete restrict,
  recipient_email text not null,
  recipient_role text not null check (recipient_role in ('customer', 'provider')),
  delivery_status text not null default 'pending' check (
    delivery_status in ('pending', 'sending', 'sent', 'failed')
  ),
  provider_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (booking_id, event_type, recipient_email)
);

create trigger booking_email_outbox_set_updated_at
before update on ceaute.booking_email_outbox
for each row execute function ceaute.set_updated_at();

alter table ceaute.booking_email_outbox enable row level security;

revoke all on ceaute.booking_email_outbox from anon, authenticated;
grant select, insert, update on ceaute.booking_email_outbox to service_role;

create index booking_email_outbox_delivery_idx
  on ceaute.booking_email_outbox (delivery_status, updated_at, created_at)
  where delivery_status in ('pending', 'failed');

create or replace function ceaute.booking_email_payload(
  target_booking ceaute.booking,
  payment_attempt ceaute.booking_payment_attempt,
  include_private_location boolean
)
returns jsonb
language sql
stable
set search_path = ceaute, public
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'booking_id', target_booking.id,
      'customer_name', target_booking.customer_snapshot ->> 'full_name',
      'customer_email', target_booking.customer_snapshot ->> 'email',
      'customer_phone', target_booking.customer_snapshot ->> 'phone',
      'provider_name', target_booking.service_snapshot ->> 'provider_display_name',
      'provider_username', target_booking.service_snapshot ->> 'provider_username',
      'treatment_name', target_booking.service_snapshot ->> 'treatment_name',
      'selected_add_ons', coalesce(target_booking.service_snapshot -> 'selected_add_ons', '[]'::jsonb),
      'start_at', target_booking.start_at,
      'end_at', target_booking.end_at,
      'public_area', target_booking.service_snapshot ->> 'public_area',
      'address_line_1', case when include_private_location then target_booking.service_snapshot ->> 'address_line_1' end,
      'address_line_2', case when include_private_location then target_booking.service_snapshot ->> 'address_line_2' end,
      'city', case when include_private_location then target_booking.service_snapshot ->> 'city' end,
      'postcode', case when include_private_location then target_booking.service_snapshot ->> 'postcode' end,
      'access_instructions', case when include_private_location then target_booking.service_snapshot ->> 'access_instructions' end,
      'amount_paid_pence', payment_attempt.amount_charged_pence,
      'amount_due_later_pence', payment_attempt.amount_due_later_pence,
      'refund_amount_pence', coalesce(target_booking.cancellation_refund_pence, payment_attempt.refund_amount_pence),
      'retained_amount_pence', coalesce(target_booking.cancellation_retained_pence, payment_attempt.retained_amount_pence),
      'refund_status', payment_attempt.payment_status,
      'cancellation_window_hours', target_booking.service_snapshot ->> 'cancellation_window_hours',
      'cancellation_deadline_at',
        target_booking.start_at - make_interval(
          hours => coalesce(nullif(target_booking.service_snapshot ->> 'cancellation_window_hours', '')::integer, 24)
        ),
      'cancelled_by', target_booking.cancelled_by,
      'cancelled_at', target_booking.cancelled_at,
      'customer_booking_path', '/account/bookings/' || target_booking.id,
      'provider_booking_path', '/provider/bookings/' || target_booking.id
    )
  );
$$;

create or replace function ceaute.enqueue_booking_transactional_emails(
  target_booking_id uuid,
  email_event text
)
returns integer
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  target_booking ceaute.booking%rowtype;
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  provider_email text;
  inserted_count integer := 0;
  last_insert_count integer := 0;
  customer_event_type text;
  provider_event_type text;
begin
  if email_event not in ('booking_confirmed', 'customer_cancelled', 'provider_cancelled') then
    raise exception 'Invalid email event.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = target_booking_id;

  if target_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where booking_id = target_booking.id;

  select auth_users.email into provider_email
  from ceaute.provider_page
  join auth.users auth_users
    on auth_users.id = provider_page.owner_profile_id
  where provider_page.id = target_booking.provider_page_id;

  customer_event_type := email_event || '_customer';
  provider_event_type := email_event || '_provider';

  insert into ceaute.booking_email_outbox (
    event_type,
    booking_id,
    recipient_email,
    recipient_role,
    payload
  )
  select
    customer_event_type,
    target_booking.id,
    target_booking.customer_snapshot ->> 'email',
    'customer',
    ceaute.booking_email_payload(target_booking, payment_attempt, email_event = 'booking_confirmed')
  where nullif(target_booking.customer_snapshot ->> 'email', '') is not null
  on conflict (booking_id, event_type, recipient_email) do nothing;

  get diagnostics inserted_count = row_count;

  insert into ceaute.booking_email_outbox (
    event_type,
    booking_id,
    recipient_email,
    recipient_role,
    payload
  )
  select
    provider_event_type,
    target_booking.id,
    provider_email,
    'provider',
    ceaute.booking_email_payload(target_booking, payment_attempt, email_event = 'booking_confirmed')
  where nullif(provider_email, '') is not null
  on conflict (booking_id, event_type, recipient_email) do nothing;

  get diagnostics last_insert_count = row_count;
  inserted_count := inserted_count + last_insert_count;

  return inserted_count;
end;
$$;

create or replace function ceaute.claim_pending_booking_emails(
  max_emails integer default 25
)
returns table (
  id uuid,
  event_type text,
  booking_id uuid,
  recipient_email text,
  recipient_role text,
  attempt_count integer,
  payload jsonb
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  return query
  with claimable_emails as (
    select booking_email_outbox.id
    from ceaute.booking_email_outbox
    where booking_email_outbox.delivery_status in ('pending', 'failed')
      and booking_email_outbox.attempt_count < 10
    order by booking_email_outbox.created_at
    limit greatest(1, least(coalesce(max_emails, 25), 100))
    for update skip locked
  ),
  claimed_emails as (
    update ceaute.booking_email_outbox
    set delivery_status = 'sending',
        attempt_count = booking_email_outbox.attempt_count + 1,
        last_error = null
    where booking_email_outbox.id in (select claimable_emails.id from claimable_emails)
    returning
      booking_email_outbox.id,
      booking_email_outbox.event_type,
      booking_email_outbox.booking_id,
      booking_email_outbox.recipient_email,
      booking_email_outbox.recipient_role,
      booking_email_outbox.attempt_count,
      booking_email_outbox.payload
  )
  select * from claimed_emails;
end;
$$;

revoke all on function ceaute.booking_email_payload(ceaute.booking, ceaute.booking_payment_attempt, boolean)
from public, anon, authenticated;
revoke all on function ceaute.enqueue_booking_transactional_emails(uuid, text)
from public, anon, authenticated;
revoke all on function ceaute.claim_pending_booking_emails(integer)
from public, anon, authenticated;

grant execute on function ceaute.enqueue_booking_transactional_emails(uuid, text)
to service_role;
grant execute on function ceaute.claim_pending_booking_emails(integer)
to service_role;
