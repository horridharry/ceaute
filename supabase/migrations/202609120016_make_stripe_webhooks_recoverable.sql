alter table ceaute.stripe_payment_event
  add column if not exists processing_status text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists received_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update ceaute.stripe_payment_event
set processing_status = coalesce(processing_status, 'completed'),
    received_at = coalesce(received_at, processed_at),
    completed_at = coalesce(completed_at, processed_at),
    attempt_count = greatest(attempt_count, 1);

alter table ceaute.stripe_payment_event
  alter column processing_status set default 'received',
  alter column processing_status set not null,
  alter column received_at set default now(),
  alter column received_at set not null,
  add constraint stripe_payment_event_processing_status_check check (
    processing_status in ('received', 'processing', 'completed', 'failed', 'ignored')
  );

create trigger stripe_payment_event_set_updated_at
before update on ceaute.stripe_payment_event
for each row execute function ceaute.set_updated_at();

alter table ceaute.stripe_connect_event
  add column if not exists processing_status text,
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_error text,
  add column if not exists received_at timestamptz,
  add column if not exists processing_started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists failed_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

update ceaute.stripe_connect_event
set processing_status = coalesce(processing_status, 'completed'),
    received_at = coalesce(received_at, processed_at),
    completed_at = coalesce(completed_at, processed_at),
    attempt_count = greatest(attempt_count, 1);

alter table ceaute.stripe_connect_event
  alter column processing_status set default 'received',
  alter column processing_status set not null,
  alter column received_at set default now(),
  alter column received_at set not null,
  add constraint stripe_connect_event_processing_status_check check (
    processing_status in ('received', 'processing', 'completed', 'failed', 'ignored')
  );

create trigger stripe_connect_event_set_updated_at
before update on ceaute.stripe_connect_event
for each row execute function ceaute.set_updated_at();

create or replace function ceaute.claim_stripe_payment_event(
  target_event_id text,
  target_event_type text,
  target_payment_attempt_id uuid,
  target_stripe_payment_intent_id text
)
returns table (action text, processing_status text, attempt_count integer)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_event ceaute.stripe_payment_event%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_event_id), '') is null or nullif(btrim(target_event_type), '') is null then
    raise exception 'Stripe event identity is required.';
  end if;

  insert into ceaute.stripe_payment_event (
    id,
    type,
    booking_payment_attempt_id,
    stripe_payment_intent_id,
    processing_status,
    attempt_count,
    received_at
  ) values (
    target_event_id,
    target_event_type,
    target_payment_attempt_id,
    target_stripe_payment_intent_id,
    'received',
    0,
    now()
  )
  on conflict (id) do nothing;

  select * into payment_event
  from ceaute.stripe_payment_event
  where id = target_event_id
  for update;

  if payment_event.type <> target_event_type
    or (payment_event.booking_payment_attempt_id is not null
      and target_payment_attempt_id is not null
      and payment_event.booking_payment_attempt_id <> target_payment_attempt_id)
    or (payment_event.stripe_payment_intent_id is not null
      and target_stripe_payment_intent_id is not null
      and payment_event.stripe_payment_intent_id <> target_stripe_payment_intent_id) then
    raise exception 'Stripe event replay does not match the original delivery.';
  end if;

  if payment_event.processing_status in ('completed', 'ignored') then
    return query select 'complete'::text, payment_event.processing_status, payment_event.attempt_count;
    return;
  end if;

  if payment_event.processing_status = 'processing'
    and payment_event.processing_started_at > now() - interval '2 minutes' then
    return query select 'processing'::text, payment_event.processing_status, payment_event.attempt_count;
    return;
  end if;

  update ceaute.stripe_payment_event
  set booking_payment_attempt_id = coalesce(booking_payment_attempt_id, target_payment_attempt_id),
      stripe_payment_intent_id = coalesce(stripe_payment_intent_id, target_stripe_payment_intent_id),
      processing_status = 'processing',
      processing_started_at = now(),
      attempt_count = stripe_payment_event.attempt_count + 1,
      last_error = null,
      failed_at = null
  where id = target_event_id
  returning * into payment_event;

  return query select 'process'::text, payment_event.processing_status, payment_event.attempt_count;
end;
$$;

create or replace function ceaute.complete_stripe_payment_event(
  target_event_id text,
  target_final_status text default 'completed'
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

  if target_final_status not in ('completed', 'ignored') then
    raise exception 'Invalid terminal event status.';
  end if;

  update ceaute.stripe_payment_event
  set processing_status = target_final_status,
      completed_at = coalesce(completed_at, now()),
      processed_at = now(),
      processing_started_at = null,
      failed_at = null,
      last_error = null
  where id = target_event_id
    and processing_status not in ('completed', 'ignored');

  if not found and not exists (
    select 1 from ceaute.stripe_payment_event
    where id = target_event_id and processing_status in ('completed', 'ignored')
  ) then
    raise exception 'Stripe payment event not found.';
  end if;
end;
$$;

create or replace function ceaute.fail_stripe_payment_event(
  target_event_id text,
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

  update ceaute.stripe_payment_event
  set processing_status = 'failed',
      failed_at = now(),
      processing_started_at = null,
      last_error = left(coalesce(nullif(btrim(target_error), ''), 'Stripe event processing failed.'), 1000)
  where id = target_event_id
    and processing_status not in ('completed', 'ignored');

  if not found and not exists (
    select 1 from ceaute.stripe_payment_event
    where id = target_event_id and processing_status in ('completed', 'ignored')
  ) then
    raise exception 'Stripe payment event not found.';
  end if;
end;
$$;

create or replace function ceaute.claim_stripe_connect_event(
  target_event_id text,
  target_event_type text,
  target_stripe_account_id text
)
returns table (action text, processing_status text, attempt_count integer)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  connect_event ceaute.stripe_connect_event%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_event_id), '') is null or nullif(btrim(target_event_type), '') is null then
    raise exception 'Stripe event identity is required.';
  end if;

  insert into ceaute.stripe_connect_event (
    id,
    type,
    stripe_account_id,
    processing_status,
    attempt_count,
    received_at
  ) values (
    target_event_id,
    target_event_type,
    target_stripe_account_id,
    'received',
    0,
    now()
  )
  on conflict (id) do nothing;

  select * into connect_event
  from ceaute.stripe_connect_event
  where id = target_event_id
  for update;

  if connect_event.type <> target_event_type
    or (connect_event.stripe_account_id is not null
      and target_stripe_account_id is not null
      and connect_event.stripe_account_id <> target_stripe_account_id) then
    raise exception 'Stripe event replay does not match the original delivery.';
  end if;

  if connect_event.processing_status in ('completed', 'ignored') then
    return query select 'complete'::text, connect_event.processing_status, connect_event.attempt_count;
    return;
  end if;

  if connect_event.processing_status = 'processing'
    and connect_event.processing_started_at > now() - interval '2 minutes' then
    return query select 'processing'::text, connect_event.processing_status, connect_event.attempt_count;
    return;
  end if;

  update ceaute.stripe_connect_event
  set stripe_account_id = coalesce(stripe_account_id, target_stripe_account_id),
      processing_status = 'processing',
      processing_started_at = now(),
      attempt_count = stripe_connect_event.attempt_count + 1,
      last_error = null,
      failed_at = null
  where id = target_event_id
  returning * into connect_event;

  return query select 'process'::text, connect_event.processing_status, connect_event.attempt_count;
end;
$$;

create or replace function ceaute.complete_stripe_connect_event(
  target_event_id text,
  target_final_status text default 'completed'
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

  if target_final_status not in ('completed', 'ignored') then
    raise exception 'Invalid terminal event status.';
  end if;

  update ceaute.stripe_connect_event
  set processing_status = target_final_status,
      completed_at = coalesce(completed_at, now()),
      processed_at = now(),
      processing_started_at = null,
      failed_at = null,
      last_error = null
  where id = target_event_id
    and processing_status not in ('completed', 'ignored');

  if not found and not exists (
    select 1 from ceaute.stripe_connect_event
    where id = target_event_id and processing_status in ('completed', 'ignored')
  ) then
    raise exception 'Stripe Connect event not found.';
  end if;
end;
$$;

create or replace function ceaute.fail_stripe_connect_event(
  target_event_id text,
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

  update ceaute.stripe_connect_event
  set processing_status = 'failed',
      failed_at = now(),
      processing_started_at = null,
      last_error = left(coalesce(nullif(btrim(target_error), ''), 'Stripe event processing failed.'), 1000)
  where id = target_event_id
    and processing_status not in ('completed', 'ignored');

  if not found and not exists (
    select 1 from ceaute.stripe_connect_event
    where id = target_event_id and processing_status in ('completed', 'ignored')
  ) then
    raise exception 'Stripe Connect event not found.';
  end if;
end;
$$;

revoke all on function ceaute.claim_stripe_payment_event(text, text, uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.complete_stripe_payment_event(text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.fail_stripe_payment_event(text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.claim_stripe_connect_event(text, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.complete_stripe_connect_event(text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.fail_stripe_connect_event(text, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.claim_stripe_payment_event(text, text, uuid, text)
to service_role;
grant execute on function ceaute.complete_stripe_payment_event(text, text)
to service_role;
grant execute on function ceaute.fail_stripe_payment_event(text, text)
to service_role;
grant execute on function ceaute.claim_stripe_connect_event(text, text, text)
to service_role;
grant execute on function ceaute.complete_stripe_connect_event(text, text)
to service_role;
grant execute on function ceaute.fail_stripe_connect_event(text, text)
to service_role;
