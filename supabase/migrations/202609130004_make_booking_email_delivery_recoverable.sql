alter table ceaute.booking_email_outbox
  add column if not exists claim_token uuid,
  add column if not exists claimed_at timestamptz,
  add column if not exists next_retry_at timestamptz not null default now();

drop index if exists ceaute.booking_email_outbox_delivery_idx;

create index booking_email_outbox_delivery_idx
  on ceaute.booking_email_outbox (next_retry_at, created_at)
  where delivery_status in ('pending', 'sending', 'failed');

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
  include_private_location boolean;
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

  if target_booking.confirming_payment_attempt_id is not null then
    select * into payment_attempt
    from ceaute.booking_payment_attempt
    where id = target_booking.confirming_payment_attempt_id;
  else
    select * into payment_attempt
    from ceaute.booking_payment_attempt
    where booking_id = target_booking.id
      and payment_status in ('succeeded', 'refund_required', 'refunded', 'refund_failed')
    order by attempt_number desc
    limit 1;
  end if;

  select auth_users.email into provider_email
  from ceaute.provider_page
  join auth.users as auth_users on auth_users.id = provider_page.owner_profile_id
  where provider_page.id = target_booking.provider_page_id;

  customer_event_type := email_event || '_customer';
  provider_event_type := email_event || '_provider';
  include_private_location := email_event = 'booking_confirmed'
    and target_booking.confirmed_at is not null
    and target_booking.status in ('confirmed', 'completed');

  insert into ceaute.booking_email_outbox (
    event_type, booking_id, recipient_email, recipient_role, payload
  )
  select
    customer_event_type,
    target_booking.id,
    target_booking.customer_snapshot ->> 'email',
    'customer',
    ceaute.booking_email_payload(target_booking, payment_attempt, include_private_location)
  where nullif(target_booking.customer_snapshot ->> 'email', '') is not null
  on conflict (booking_id, event_type, recipient_email) do nothing;

  get diagnostics inserted_count = row_count;

  insert into ceaute.booking_email_outbox (
    event_type, booking_id, recipient_email, recipient_role, payload
  )
  select
    provider_event_type,
    target_booking.id,
    provider_email,
    'provider',
    ceaute.booking_email_payload(target_booking, payment_attempt, include_private_location)
  where nullif(provider_email, '') is not null
  on conflict (booking_id, event_type, recipient_email) do nothing;

  get diagnostics last_insert_count = row_count;
  return inserted_count + last_insert_count;
end;
$$;

create or replace function ceaute.enqueue_booking_emails_after_transition()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if old.status is distinct from new.status
    and new.status = 'confirmed'
    and new.confirmed_at is not null then
    perform ceaute.enqueue_booking_transactional_emails(new.id, 'booking_confirmed');
  elsif old.status = 'confirmed'
    and new.status = 'cancelled'
    and new.confirmed_at is not null
    and new.cancelled_by in ('customer', 'provider') then
    perform ceaute.enqueue_booking_transactional_emails(
      new.id,
      case new.cancelled_by
        when 'provider' then 'provider_cancelled'
        else 'customer_cancelled'
      end
    );
  end if;

  return null;
end;
$$;

drop trigger if exists booking_enqueue_transactional_emails on ceaute.booking;

create constraint trigger booking_enqueue_transactional_emails
after update of status on ceaute.booking
deferrable initially deferred
for each row execute function ceaute.enqueue_booking_emails_after_transition();

drop function if exists ceaute.claim_pending_booking_emails(integer);

create function ceaute.claim_pending_booking_emails(
  max_emails integer default 25
)
returns table (
  id uuid,
  claim_token uuid,
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
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  return query
  with claimable_emails as (
    select booking_email_outbox.id
    from ceaute.booking_email_outbox
    where booking_email_outbox.attempt_count < 10
      and (
        (booking_email_outbox.delivery_status in ('pending', 'failed')
          and booking_email_outbox.next_retry_at <= now())
        or (booking_email_outbox.delivery_status = 'sending'
          and booking_email_outbox.claimed_at <= now() - interval '5 minutes')
      )
    order by booking_email_outbox.next_retry_at, booking_email_outbox.created_at
    limit greatest(1, least(coalesce(max_emails, 25), 100))
    for update skip locked
  ),
  claimed_emails as (
    update ceaute.booking_email_outbox
    set delivery_status = 'sending',
        attempt_count = booking_email_outbox.attempt_count + 1,
        claim_token = gen_random_uuid(),
        claimed_at = now(),
        last_error = null
    where booking_email_outbox.id in (select claimable_emails.id from claimable_emails)
    returning
      booking_email_outbox.id,
      booking_email_outbox.claim_token,
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

create or replace function ceaute.record_booking_email_sent(
  target_email_id uuid,
  target_claim_token uuid,
  target_provider_message_id text
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

  if nullif(btrim(target_provider_message_id), '') is null then
    raise exception 'Provider message ID is required.';
  end if;

  update ceaute.booking_email_outbox
  set delivery_status = 'sent',
      provider_message_id = target_provider_message_id,
      sent_at = coalesce(sent_at, now()),
      claim_token = null,
      claimed_at = null,
      last_error = null
  where id = target_email_id
    and delivery_status = 'sending'
    and claim_token = target_claim_token;

  if not found then
    raise exception 'Email delivery claim is no longer active.';
  end if;
end;
$$;

create or replace function ceaute.record_booking_email_retryable_failure(
  target_email_id uuid,
  target_claim_token uuid,
  target_error text
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

  update ceaute.booking_email_outbox
  set delivery_status = 'failed',
      claim_token = null,
      claimed_at = null,
      last_error = left(coalesce(nullif(btrim(target_error), ''), 'Email delivery failed.'), 1000),
      next_retry_at = now() + make_interval(
        secs => least(3600, (30 * power(2, greatest(attempt_count - 1, 0)))::integer)
      )
  where id = target_email_id
    and delivery_status = 'sending'
    and claim_token = target_claim_token;

  if not found then
    raise exception 'Email delivery claim is no longer active.';
  end if;
end;
$$;

revoke all on function ceaute.enqueue_booking_transactional_emails(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.enqueue_booking_emails_after_transition()
from public, anon, authenticated, service_role;
revoke all on function ceaute.claim_pending_booking_emails(integer)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_email_sent(uuid, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_booking_email_retryable_failure(uuid, uuid, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_pending_booking_emails(integer)
to service_role;
grant execute on function ceaute.record_booking_email_sent(uuid, uuid, text)
to service_role;
grant execute on function ceaute.record_booking_email_retryable_failure(uuid, uuid, text)
to service_role;
