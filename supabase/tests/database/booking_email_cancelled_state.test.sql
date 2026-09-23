begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(18);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

-- A real booking to hang outbox rows on. Nothing here is confirmed, so no
-- email is enqueued by the booking itself.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09400000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'outbox-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09400000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'outbox-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Outbox Customer', phone_e164 = '+447700900944'
where id::text like '09400000-%';

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, provider_category, status)
values ('19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000002', 'outbox.studio', 'Outbox Studio', 'Nails', 'published');

insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active)
values ('19400000-0000-0000-0000-000000000001', 'Hackney, London', '4 Secret Mews', 'London', 'E8 1AB', 'Side door', true);

insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, deposit_percent, cancellation_window_hours)
values ('19400000-0000-0000-0000-000000000001', 'deposit', 30, 24);

insert into ceaute.provider_payment_account (provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status)
values ('19400000-0000-0000-0000-000000000001', 'acct_outbox', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
values ('19400000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '09400000-0000-0000-0000-000000000002');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '19400000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (id, provider_page_id, name, duration_minutes, price_pence, is_active)
values ('29400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001', 'Outbox manicure', 60, 4000, true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table outbox_hold as
select ceaute.create_validated_booking_hold(
  '09400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001',
  '29400000-0000-0000-0000-000000000001', array[]::uuid[],
  ((((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London')
) as id;

reset role;

-- Only the rows below may exist, so the claim result is exact.
delete from ceaute.booking_email_outbox;

-- One row per existing status, plus two cancelled rows: one plainly due, and
-- one cancelled while it still held an expired claim (the case most likely to
-- be mistaken for a reclaimable `sending` row).
insert into ceaute.booking_email_outbox (
  id, event_type, booking_id, recipient_email, recipient_role,
  delivery_status, attempt_count, last_error, provider_message_id, sent_at,
  claim_token, claimed_at, next_retry_at
)
select v.id, 'booking_confirmed_customer', (select id from outbox_hold), v.recipient_email, 'customer',
  v.delivery_status, v.attempt_count, v.last_error, v.provider_message_id, v.sent_at,
  v.claim_token, v.claimed_at, now() - interval '1 minute'
from (values
  ('49400000-0000-0000-0000-000000000001'::uuid, 'pending@example.test', 'pending', 0, null, null, null::timestamptz, null::uuid, null::timestamptz),
  ('49400000-0000-0000-0000-000000000002', 'failed@example.test', 'failed', 1, 'Transient', null, null, null, null),
  ('49400000-0000-0000-0000-000000000003', 'sending@example.test', 'sending', 1, null, null, null, 'a0000000-0000-0000-0000-000000000003', now() - interval '6 minutes'),
  ('49400000-0000-0000-0000-000000000004', 'sent@example.test', 'sent', 1, null, 'resend_already_sent', now() - interval '1 hour', null, null)
) as v(id, recipient_email, delivery_status, attempt_count, last_error, provider_message_id, sent_at, claim_token, claimed_at);

insert into tap_results select lives_ok(
  $$insert into ceaute.booking_email_outbox (
      id, event_type, booking_id, recipient_email, recipient_role, delivery_status, next_retry_at
    )
    values ('49400000-0000-0000-0000-000000000005', 'booking_confirmed_customer',
      (select id from outbox_hold), 'cancelled@example.test', 'customer', 'cancelled', now() - interval '1 minute')$$,
  'The delivery status constraint accepts cancelled');

insert into tap_results select lives_ok(
  $$insert into ceaute.booking_email_outbox (
      id, event_type, booking_id, recipient_email, recipient_role, delivery_status,
      attempt_count, claim_token, claimed_at, next_retry_at
    )
    values ('49400000-0000-0000-0000-000000000006', 'booking_confirmed_customer',
      (select id from outbox_hold), 'cancelled-claimed@example.test', 'customer', 'cancelled',
      1, 'c0000000-0000-0000-0000-000000000006', now() - interval '6 minutes', now() - interval '1 minute')$$,
  'A row with a stale claim can be cancelled');

insert into ceaute.booking_email_outbox (
  id, event_type, booking_id, recipient_email, recipient_role, next_retry_at
)
values ('49400000-0000-0000-0000-000000000007', 'booking_confirmed_customer',
  (select id from outbox_hold), 'withdrawn@example.test', 'customer', now() - interval '1 minute');

insert into tap_results select lives_ok(
  $$update ceaute.booking_email_outbox set delivery_status = 'cancelled'
    where id = '49400000-0000-0000-0000-000000000007'$$,
  'A pending row can be moved to cancelled');

insert into tap_results select throws_ok(
  $$insert into ceaute.booking_email_outbox (
      event_type, booking_id, recipient_email, recipient_role, delivery_status
    )
    values ('booking_confirmed_customer', (select id from outbox_hold), 'bogus@example.test', 'customer', 'discarded')$$,
  '23514', null,
  'The constraint still rejects any other delivery status');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table first_claim as
select * from ceaute.claim_pending_booking_emails(100);

reset role;

insert into tap_results select is(
  (select array_agg(id order by id) from first_claim),
  array[
    '49400000-0000-0000-0000-000000000001',
    '49400000-0000-0000-0000-000000000002',
    '49400000-0000-0000-0000-000000000003'
  ]::uuid[],
  'Only the due pending, due failed and expired sending rows are claimed');

insert into tap_results select is(
  (select count(*)::integer from first_claim
   where id in ('49400000-0000-0000-0000-000000000005',
                '49400000-0000-0000-0000-000000000006',
                '49400000-0000-0000-0000-000000000007')),
  0,
  'No cancelled row is claimed, even one that still carries an expired claim');

insert into tap_results select is(
  (select array_agg(row(delivery_status, attempt_count, claim_token)::text order by id)
   from ceaute.booking_email_outbox
   where id in ('49400000-0000-0000-0000-000000000005',
                '49400000-0000-0000-0000-000000000006',
                '49400000-0000-0000-0000-000000000007')),
  array[
    '(cancelled,0,)',
    '(cancelled,1,c0000000-0000-0000-0000-000000000006)',
    '(cancelled,0,)'
  ],
  'A claim pass leaves cancelled rows untouched');

insert into tap_results select is(
  (select array_agg(row(delivery_status, attempt_count)::text order by id)
   from ceaute.booking_email_outbox
   where id in ('49400000-0000-0000-0000-000000000001',
                '49400000-0000-0000-0000-000000000002',
                '49400000-0000-0000-0000-000000000003')),
  array['(sending,1)', '(sending,2)', '(sending,2)'],
  'Claimed pending, failed and expired sending rows become sending with one more attempt');

insert into tap_results select isnt(
  (select claim_token from first_claim where id = '49400000-0000-0000-0000-000000000003'),
  'a0000000-0000-0000-0000-000000000003'::uuid,
  'An expired sending claim is still reclaimed with a new token');

insert into tap_results select is(
  (select row(delivery_status, attempt_count, provider_message_id)::text
   from ceaute.booking_email_outbox where id = '49400000-0000-0000-0000-000000000004'),
  '(sent,1,resend_already_sent)',
  'A sent row is still never claimed');

grant select on table first_claim to service_role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_ok(
  $$select ceaute.record_booking_email_sent(
      '49400000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'resend_should_not_exist')$$,
  'P0001', 'Email delivery claim is no longer active.',
  'A cancelled row cannot be recorded as sent, even with the claim token it held');

insert into tap_results select throws_ok(
  $$select ceaute.record_booking_email_retryable_failure(
      '49400000-0000-0000-0000-000000000006', 'c0000000-0000-0000-0000-000000000006', 'Should not apply')$$,
  'P0001', 'Email delivery claim is no longer active.',
  'A cancelled row cannot be put back into the retry queue as failed');

insert into tap_results select lives_ok(
  $$select ceaute.record_booking_email_sent(
      '49400000-0000-0000-0000-000000000001',
      (select claim_token from first_claim where id = '49400000-0000-0000-0000-000000000001'),
      'resend_pending_sent')$$,
  'A claimed pending row is still finalized as sent');

insert into tap_results select lives_ok(
  $$select ceaute.record_booking_email_retryable_failure(
      '49400000-0000-0000-0000-000000000002',
      (select claim_token from first_claim where id = '49400000-0000-0000-0000-000000000002'),
      'Transient again')$$,
  'A claimed failed row still records a retryable failure');

reset role;

insert into tap_results select is(
  (select row(delivery_status, provider_message_id)::text
   from ceaute.booking_email_outbox where id = '49400000-0000-0000-0000-000000000001'),
  '(sent,resend_pending_sent)',
  'Sent remains the result of a successful delivery');

insert into tap_results select ok(
  (select delivery_status = 'failed' and next_retry_at > now()
   from ceaute.booking_email_outbox where id = '49400000-0000-0000-0000-000000000002'),
  'Failed remains a backed-off retry state');

insert into tap_results select is(
  (select row(delivery_status, attempt_count, claim_token, provider_message_id)::text
   from ceaute.booking_email_outbox where id = '49400000-0000-0000-0000-000000000006'),
  '(cancelled,1,c0000000-0000-0000-0000-000000000006,)',
  'The cancelled row is unchanged after both refused recordings');

-- A later pass, with every retry time already due, still never reaches a
-- cancelled row.
update ceaute.booking_email_outbox set next_retry_at = now() - interval '1 minute';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select is(
  (select array_agg(id order by id) from ceaute.claim_pending_booking_emails(100)),
  array['49400000-0000-0000-0000-000000000002']::uuid[],
  'A later pass claims only the due failed row and never a cancelled one');

reset role;

insert into tap_results select * from finish();
select result from tap_results;
rollback;
