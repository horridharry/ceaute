begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(41);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'consistency-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'consistency-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Consistency Test', phone_e164 = '+447700900222'
where id in (
  '02000000-0000-0000-0000-000000000001',
  '02000000-0000-0000-0000-000000000002'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values (
  '12000000-0000-0000-0000-000000000001',
  '02000000-0000-0000-0000-000000000002',
  'consistency.provider', 'Consistency Provider', 'Consistency fixture', 'Nails', 'published'
);

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
values (
  '12000000-0000-0000-0000-000000000001', 'Central London', '12 Private Street',
  'London', 'SW1A 1AA', 'Use the private entrance', true
);

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent,
  cancellation_window_hours, written_policy
)
values (
  '12000000-0000-0000-0000-000000000001', 'full', 20, 24, 'Fixture policy'
);

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
values ('12000000-0000-0000-0000-000000000001', 'acct_consistency', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('12000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '02000000-0000-0000-0000-000000000002');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '12000000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values
  ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Active treatment', 'Fixture', 60, 5000, true),
  ('22000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'Inactive treatment', 'Fixture', 60, 5000, false);

insert into ceaute.treatment_add_on (
  id, provider_page_id, name, additional_price_pence, additional_duration_minutes, is_active
)
values
  ('23000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001', 'Compatible add-on', 500, 15, true),
  ('23000000-0000-0000-0000-000000000002', '12000000-0000-0000-0000-000000000001', 'Incompatible add-on', 500, 15, true);

insert into ceaute.treatment_add_on_compatibility (
  treatment_add_on_id, treatment_id, provider_page_id
)
values (
  '23000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001'
);

create temp table consistency_times as
select
  (((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London' as valid_start,
  (((now() at time zone 'Europe/London')::date + 4)::timestamp + time '12:00') at time zone 'Europe/London' as blocked_start,
  (((now() at time zone 'Europe/London')::date + 5)::timestamp + time '15:45') at time zone 'Europe/London' as boundary_start,
  (((now() at time zone 'Europe/London')::date + 6)::timestamp + time '10:00') at time zone 'Europe/London' as partial_start,
  (((now() at time zone 'Europe/London')::date + 61)::timestamp + time '12:00') at time zone 'Europe/London' as outside_window_start;

grant select on table consistency_times to authenticated, service_role;

insert into ceaute.blocked_date (provider_page_id, local_date, reason)
select
  '12000000-0000-0000-0000-000000000001',
  (blocked_start at time zone 'Europe/London')::date,
  'Consistency fixture'
from consistency_times;

insert into tap_results (result) select ok(
  to_regprocedure('ceaute.create_booking_hold(uuid,uuid,uuid[],timestamp with time zone)') is null,
  'The client-facing hold function no longer exists'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L, %L, %L, array[]::uuid[], %L)',
    '02000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    (select valid_start from consistency_times)
  ),
  'permission denied',
  'An authenticated browser cannot insert a hold directly'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table valid_hold as
select ceaute.create_validated_booking_hold(
  '02000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  array['23000000-0000-0000-0000-000000000001']::uuid[],
  (select valid_start from consistency_times)
) as id;

grant select on table valid_hold to authenticated;

insert into tap_results (result) select ok((select id from valid_hold) is not null,
  'The trusted operation creates a valid hold');
insert into tap_results (result) select ok(
  (select expires_at between now() + interval '9 minutes 55 seconds' and now() + interval '10 minutes 5 seconds'
   from ceaute.booking where id = (select id from valid_hold)),
  'A new hold lasts ten minutes'
);

insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', (select valid_start + interval '7 minutes' from consistency_times)
  ), 'outside the booking rules', 'Off-grid starts are rejected');
insert into tap_results (result) select throws_matching(
  $$select ceaute.create_validated_booking_hold('02000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','22000000-0000-0000-0000-000000000001',array[]::uuid[],now() + interval '1 hour')$$,
  'outside the booking rules', 'The minimum notice is enforced');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', (select outside_window_start from consistency_times)
  ), 'outside the booking rules', 'The booking window is enforced');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    (select date_trunc('day', valid_start at time zone 'Europe/London') + time '18:00' from consistency_times)
  ), 'Requested time is unavailable', 'Availability hours are enforced');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', (select blocked_start from consistency_times)
  ), 'Requested date is blocked', 'Blocked dates are enforced');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000002', (select valid_start + interval '2 hours' from consistency_times)
  ), 'Treatment not available', 'Inactive treatments are rejected');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[%L]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000002',
    (select valid_start + interval '2 hours' from consistency_times)
  ), 'Selected add-ons are not available', 'Incompatible add-ons are rejected');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[%L]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', '23000000-0000-0000-0000-000000000001',
    (select valid_start from consistency_times)
  ), 'conflicting key value violates exclusion constraint', 'The overlap constraint remains the final guard');

create temp table boundary_hold as
select ceaute.create_validated_booking_hold(
  '02000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  array['23000000-0000-0000-0000-000000000001']::uuid[],
  (select boundary_start from consistency_times)
) as id;

insert into tap_results (result) select is(
  (select end_at at time zone 'Europe/London' from ceaute.booking where id = (select id from boundary_hold)),
  (select (boundary_start at time zone 'Europe/London') + interval '75 minutes' from consistency_times),
  'A valid duration ending exactly at closing remains bookable'
);

create temp table partial_hold as
select ceaute.create_validated_booking_hold(
  '02000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select partial_start from consistency_times)
) as id;

create temp table partial_checkout_claim as
select * from ceaute.claim_booking_checkout(
  (select id from partial_hold), 5000, 5000, 0, 500, 'gbp', 'acct_consistency'
);

insert into tap_results (result) select is(
  (select expires_at from ceaute.booking where id = (select id from partial_hold)),
  (select checkout_request_expires_at from ceaute.booking_payment_attempt
   where id = (select payment_attempt_id from partial_checkout_claim)),
  'Claiming Checkout creation reserves the slot through the persisted request window'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from partial_checkout_claim),
    (select claim_token from partial_checkout_claim),
    'cs_partial', null, 'https://checkout.stripe.test/partial', now() + interval '2 hours'
  )$$,
  'Stripe Checkout expiry does not match',
  'Invalid Checkout persistence cannot extend the hold'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.retire_unpersisted_booking_checkout(
    (select payment_attempt_id from partial_checkout_claim),
    (select claim_token from partial_checkout_claim),
    'cs_partial', now() - interval '1 second', 'Persistence failed after Stripe expiry'
  )$$,
  'An expired unpersisted Stripe Session is retired recoverably'
);
insert into tap_results (result) select is(
  (select payment_status from ceaute.booking_payment_attempt
   where id = (select payment_attempt_id from partial_checkout_claim)),
  'expired',
  'The failed Session is terminal rather than left payable'
);

create temp table recovered_checkout_claim as
select * from ceaute.claim_booking_checkout(
  (select id from partial_hold), 5000, 5000, 0, 500, 'gbp', 'acct_consistency'
);

insert into tap_results (result) select isnt(
  (select payment_attempt_id from recovered_checkout_claim),
  (select payment_attempt_id from partial_checkout_claim),
  'Recovery creates a distinct attempt after the failed Session is expired'
);
select ceaute.record_booking_checkout_session(
  (select payment_attempt_id from recovered_checkout_claim),
  (select claim_token from recovered_checkout_claim),
  'cs_expiry_release', null, 'https://checkout.stripe.test/expiry-release', now() + interval '30 minutes'
);
select ceaute.mark_booking_payment_attempt_failed(
  (select payment_attempt_id from recovered_checkout_claim),
  'cs_expiry_release', null, 'Checkout session expired.', true
);

insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from partial_hold)),
  'cancelled',
  'Stripe Session expiry releases the unpaid booking'
);
insert into tap_results (result) select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001', (select partial_start from consistency_times)
  ),
  'The expired Session slot is immediately bookable again'
);

create temp table consistency_checkout_claim as
select * from ceaute.claim_booking_checkout(
  (select id from valid_hold), 5500, 5500, 0, 550, 'gbp', 'acct_consistency'
);

insert into tap_results (result) select is((select action from consistency_checkout_claim), 'create',
  'Checkout creation is claimed once');
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from consistency_checkout_claim),
    (select claim_token from consistency_checkout_claim),
    'cs_consistency', null, 'https://checkout.stripe.test/consistency', now() + interval '30 minutes'
  )$$,
  'An active Checkout Session is persisted atomically'
);
insert into tap_results (result) select is(
  (select expires_at from ceaute.booking where id = (select id from valid_hold)),
  (select stripe_checkout_expires_at from ceaute.booking_payment_attempt
    where id = (select payment_attempt_id from consistency_checkout_claim)),
  'The reservation cannot expire before its payable Checkout Session'
);
insert into tap_results (result) select is(
  (select stripe_checkout_session_id from ceaute.claim_booking_checkout(
    (select id from valid_hold), 5500, 5500, 0, 550, 'gbp', 'acct_consistency')),
  'cs_consistency',
  'Re-entering payment resumes the same Checkout Session'
);

insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from consistency_checkout_claim),
    'pi_consistency', 'cs_consistency', 'paid', 'gbp', 5500)),
  'confirmed',
  'A matching paid Session still confirms atomically'
);

set constraints booking_enqueue_transactional_emails immediate;

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from valid_hold) and event_type like 'booking_confirmed_%'),
  2,
  'Confirmation enqueues both transactional emails in the booking transaction'
);
insert into tap_results (result) select ok(
  (select bool_and(payload ? 'address_line_1' and payload ? 'postcode')
   from ceaute.booking_email_outbox
   where booking_id = (select id from valid_hold) and event_type like 'booking_confirmed_%'),
  'Paid confirmation emails contain the private appointment address'
);

set constraints booking_enqueue_transactional_emails deferred;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table consistency_cancellation as
select * from ceaute.prepare_booking_cancellation((select id from valid_hold), 'customer');

set constraints booking_enqueue_transactional_emails immediate;

insert into tap_results (result) select is((select outcome from consistency_cancellation), 'cancelled',
  'Authorized cancellation still succeeds');
insert into tap_results (result) select is(
  (select outcome from ceaute.prepare_booking_cancellation((select id from valid_hold), 'customer')),
  'already_cancelled',
  'Repeated cancellation remains idempotent'
);

reset role;
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from valid_hold) and event_type like 'customer_cancelled_%'),
  2,
  'Cancellation enqueues one email per recipient exactly once'
);
insert into tap_results (result) select ok(
  (select bool_and(not (payload ?| array['address_line_1','address_line_2','city','postcode','access_instructions']))
   from ceaute.booking_email_outbox
   where booking_id = (select id from valid_hold) and event_type like 'customer_cancelled_%'),
  'Cancellation emails never contain private address data'
);

create temp table selected_email as
select id from ceaute.booking_email_outbox
where booking_id = (select id from valid_hold)
order by created_at, id
limit 1;

grant select on table selected_email to service_role;

update ceaute.booking_email_outbox
set next_retry_at = now() + interval '1 day';

update ceaute.booking_email_outbox
set next_retry_at = now()
where id = (select id from selected_email);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table first_email_claim as select * from ceaute.claim_pending_booking_emails(1);
insert into tap_results (result) select is((select id from first_email_claim), (select id from selected_email),
  'A due outbox item is claimed');

reset role;
update ceaute.booking_email_outbox
set claimed_at = now() - interval '6 minutes'
where id = (select id from selected_email);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temp table second_email_claim as select * from ceaute.claim_pending_booking_emails(1);

insert into tap_results (result) select isnt(
  (select claim_token from second_email_claim), (select claim_token from first_email_claim),
  'A stale sending claim is safely reclaimed with a new token');
insert into tap_results (result) select is(
  (select id from second_email_claim), (select id from first_email_claim),
  'Every retry keeps the outbox ID used as the Resend idempotency key');
insert into tap_results (result) select is((select attempt_count from second_email_claim), 2,
  'Outbox delivery attempts are counted');
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_email_retryable_failure(
    (select id from second_email_claim), (select claim_token from second_email_claim), 'Transient Resend failure'
  )$$,
  'Delivery failure is recorded as retryable'
);
insert into tap_results (result) select ok(
  (select delivery_status = 'failed' and next_retry_at > now()
   from ceaute.booking_email_outbox where id = (select id from selected_email)),
  'A failed email receives bounded backoff state'
);

reset role;
update ceaute.booking_email_outbox set next_retry_at = now() - interval '1 minute'
where id = (select id from selected_email);
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temp table third_email_claim as select * from ceaute.claim_pending_booking_emails(1);

insert into tap_results (result) select is((select id from third_email_claim), (select id from selected_email),
  'A failed email becomes claimable after its retry time');
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_email_sent(
    (select id from third_email_claim), (select claim_token from third_email_claim), 'resend_consistency'
  )$$,
  'A claimed email can be finalized as sent'
);
insert into tap_results (result) select is(
  (select delivery_status from ceaute.booking_email_outbox where id = (select id from selected_email)),
  'sent',
  'Sent delivery state is terminal'
);

reset role;
update ceaute.booking_email_outbox
set delivery_status = 'failed', attempt_count = 10, next_retry_at = now() - interval '1 minute'
where booking_id = (select id from valid_hold) and id <> (select id from selected_email);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.claim_pending_booking_emails(10)),
  0,
  'The outbox stops retrying after the bounded attempt limit'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
