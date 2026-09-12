begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(42);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '01000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'integrity-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '01000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'integrity-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Payment Integrity Test', phone_e164 = '+447700900111'
where id in (
  '01000000-0000-0000-0000-000000000001',
  '01000000-0000-0000-0000-000000000002'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values (
  '11000000-0000-0000-0000-000000000001',
  '01000000-0000-0000-0000-000000000002',
  'integrity.provider',
  'Integrity Provider',
  'Payment integrity fixture',
  'Nails',
  'published'
);

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
values (
  '21000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  'Integrity treatment',
  'Test treatment',
  60,
  5000,
  (select id from ceaute.discovery_category order by display_order limit 1),
  true
);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, customer_snapshot, service_snapshot
)
values
  (
    '31000000-0000-0000-0000-000000000001',
    '01000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    now() + interval '10 days', now() + interval '10 days 1 hour',
    'awaiting_payment', now() + interval '5 minutes', '{}',
    '{"cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    '01000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    now() + interval '11 days', now() + interval '11 days 1 hour',
    'awaiting_payment', now() + interval '5 minutes', '{}',
    '{"cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    '01000000-0000-0000-0000-000000000001',
    '11000000-0000-0000-0000-000000000001',
    '21000000-0000-0000-0000-000000000001',
    now() + interval '12 days', now() + interval '12 days 1 hour',
    'awaiting_payment', now() - interval '1 minute', '{}',
    '{"cancellation_window_hours":24,"commitment_amount_pence":1000}'
  );

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table first_checkout_claim as
select * from ceaute.claim_booking_checkout(
  '31000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
  'gbp', 'acct_integrity'
);

insert into tap_results (result) select is((select action from first_checkout_claim), 'create',
  'The first checkout caller atomically claims creation');
insert into tap_results (result) select is(
  (select action from ceaute.claim_booking_checkout(
    '31000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
    'gbp', 'acct_integrity')),
  'processing',
  'A concurrent checkout caller cannot create another session'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_payment_attempt
    where booking_id = '31000000-0000-0000-0000-000000000001'),
  1,
  'Concurrent checkout claims preserve one active attempt'
);

insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from first_checkout_claim),
    (select claim_token from first_checkout_claim),
    'cs_integrity_one', null, 'https://checkout.stripe.test/one',
    now() + interval '30 minutes'
  )$$,
  'A Checkout Session can be persisted before Stripe creates its PaymentIntent'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_booking_checkout(
    '31000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
    'gbp', 'acct_integrity')),
  'reuse',
  'An open Checkout Session is reused'
);

insert into tap_results (result) select throws_matching(
  $$select * from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_checkout_claim),
    'pi_integrity_one', 'cs_forged', 'paid', 'gbp', 5000
  )$$,
  'Stripe Checkout Session does not match',
  'A mismatched Checkout Session is rejected'
);
insert into tap_results (result) select throws_matching(
  $$select * from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_checkout_claim),
    'pi_integrity_one', 'cs_integrity_one', 'paid', 'gbp', 4999
  )$$,
  'Stripe payment details do not match',
  'A mismatched authoritative amount is rejected'
);
insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_checkout_claim),
    'pi_integrity_one', 'cs_integrity_one', 'paid', 'gbp', 5000
  )),
  'confirmed',
  'A matching paid Checkout confirms the booking'
);
insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_checkout_claim),
    'pi_integrity_one', 'cs_integrity_one', 'paid', 'gbp', 5000
  )),
  'already_processed',
  'A replayed paid Checkout is idempotent'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_booking_checkout(
    '31000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
    'gbp', 'acct_integrity')),
  'terminal',
  'A succeeded booking cannot receive another Checkout'
);

create temp table replacement_first_claim as
select * from ceaute.claim_booking_checkout(
  '31000000-0000-0000-0000-000000000002', 1000, 5000, 4000, 100,
  'gbp', 'acct_integrity'
);

insert into tap_results (result) select is((select action from replacement_first_claim), 'create',
  'A fixed-deposit Checkout is claimed');
insert into tap_results (result) select is(
  (select amount_due_later_pence from ceaute.booking_payment_attempt
    where id = (select payment_attempt_id from replacement_first_claim)),
  4000::bigint,
  'Fixed-deposit authoritative amount due later is preserved'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from replacement_first_claim),
    (select claim_token from replacement_first_claim),
    'cs_integrity_old', null, 'https://checkout.stripe.test/old',
    now() - interval '1 minute'
  )$$,
  'An expired Checkout fixture is persisted'
);

create temp table replacement_claim as
select * from ceaute.replace_expired_checkout_attempt(
  (select payment_attempt_id from replacement_first_claim)
);

insert into tap_results (result) select isnt(
  (select payment_attempt_id from replacement_claim),
  (select payment_attempt_id from replacement_first_claim),
  'An expired Checkout receives a distinct replacement attempt'
);
insert into tap_results (result) select is(
  (select payment_status from ceaute.booking_payment_attempt
    where id = (select payment_attempt_id from replacement_first_claim)),
  'expired',
  'The replaced attempt remains as terminal history'
);
insert into tap_results (result) select isnt(
  (select checkout_idempotency_key from replacement_claim),
  (select checkout_idempotency_key from replacement_first_claim),
  'A replacement attempt has its own stable idempotency key'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from replacement_claim),
    (select claim_token from replacement_claim),
    'cs_integrity_new', null, 'https://checkout.stripe.test/new',
    now() + interval '30 minutes'
  )$$,
  'The replacement Checkout is persisted'
);
insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from replacement_claim),
    'pi_integrity_new', 'cs_integrity_new', 'paid', 'gbp', 1000
  )),
  'confirmed',
  'The replacement fixed-deposit payment confirms the booking'
);
insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from replacement_first_claim),
    'pi_integrity_old', 'cs_integrity_old', 'paid', 'gbp', 1000
  )),
  'duplicate_payment',
  'A genuine late duplicate payment is flagged for refund'
);

reset role;
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_refund_operation
    where booking_payment_attempt_id = (select payment_attempt_id from replacement_first_claim)
      and purpose = 'duplicate_payment'),
  1,
  'A genuine duplicate payment has exactly one refund operation'
);

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values (
  '41000000-0000-0000-0000-000000000003',
  '31000000-0000-0000-0000-000000000003',
  1,
  'ceaute-checkout-41000000-0000-0000-0000-000000000003',
  'cs_integrity_late',
  'pi_integrity_late',
  5000, 5000, 0, 500, 'checkout_created', 'acct_integrity'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table late_payment_result as
select * from ceaute.complete_booking_payment_attempt(
  '41000000-0000-0000-0000-000000000003',
  'pi_integrity_late', 'cs_integrity_late', 'paid', 'gbp', 5000
);

insert into tap_results (result) select is((select outcome from late_payment_result), 'refund_required',
  'A payment after hold expiry is routed to refund rather than confirmation');
insert into tap_results (result) select is(
  (select refund_operation_id from ceaute.complete_booking_payment_attempt(
    '41000000-0000-0000-0000-000000000003',
    'pi_integrity_late', 'cs_integrity_late', 'paid', 'gbp', 5000
  )),
  (select refund_operation_id from late_payment_result),
  'A late-payment replay reuses the same refund operation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '01000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table cancellation_result as
select * from ceaute.prepare_booking_cancellation(
  '31000000-0000-0000-0000-000000000001', 'customer'
);

insert into tap_results (result) select is((select outcome from cancellation_result), 'cancelled',
  'An authorized paid booking cancellation succeeds');
insert into tap_results (result) select is(
  (select outcome from ceaute.prepare_booking_cancellation(
    '31000000-0000-0000-0000-000000000001', 'customer')),
  'already_cancelled',
  'A repeated cancellation is idempotent'
);

reset role;
grant select on table cancellation_result to service_role;
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_refund_operation
    where booking_id = '31000000-0000-0000-0000-000000000001'
      and purpose = 'cancellation'),
  1,
  'Repeated cancellation persists exactly one refund operation'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table refund_claim as
select * from ceaute.claim_booking_refund_operation(
  (select refund_operation_id from cancellation_result)
);

insert into tap_results (result) select is((select action from refund_claim), 'create',
  'The cancellation refund is claimed for one Stripe create call');
insert into tap_results (result) select is(
  (select action from ceaute.claim_booking_refund_operation(
    (select refund_operation_id from cancellation_result))),
  'processing',
  'A concurrent refund worker cannot create another refund'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_refund_state(
    (select refund_operation_id from cancellation_result),
    're_integrity', 'pi_integrity_one', 5000, 'pending', null
  )$$,
  'A pending Stripe refund remains pending'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_booking_refund_operation(
    (select refund_operation_id from cancellation_result))),
  'reconcile',
  'Retry reconciles the known Stripe refund instead of creating another'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.record_booking_refund_state(
    (select refund_operation_id from cancellation_result),
    're_integrity', 'pi_integrity_one', 5000, 'succeeded', null
  )$$,
  'A succeeded refund is persisted as terminal success'
);

insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_payment_event(
    'evt_payment_retry', 'checkout.session.completed',
    '41000000-0000-0000-0000-000000000003', 'pi_integrity_late')),
  'process',
  'A new payment webhook is claimed for processing'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.fail_stripe_payment_event('evt_payment_retry', 'Transient database failure')$$,
  'A failed payment webhook is retained for retry'
);

create temp table payment_retry_claim as
select * from ceaute.claim_stripe_payment_event(
  'evt_payment_retry', 'checkout.session.completed',
  '41000000-0000-0000-0000-000000000003', 'pi_integrity_late'
);

insert into tap_results (result) select is((select action from payment_retry_claim), 'process',
  'A failed payment webhook is claimed again');
insert into tap_results (result) select is((select attempt_count from payment_retry_claim), 2,
  'Payment webhook retry attempts are counted');
insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_payment_event(
    'evt_payment_retry', 'checkout.session.completed',
    '41000000-0000-0000-0000-000000000003', 'pi_integrity_late')),
  'processing',
  'Concurrent payment webhook processing is rejected'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.complete_stripe_payment_event('evt_payment_retry', 'completed')$$,
  'A successful payment webhook becomes terminal'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_payment_event(
    'evt_payment_retry', 'checkout.session.completed',
    '41000000-0000-0000-0000-000000000003', 'pi_integrity_late')),
  'complete',
  'A completed payment webhook replay is idempotent'
);

insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_connect_event(
    'evt_connect_retry', 'v2.core.account.updated', 'acct_integrity')),
  'process',
  'A new Connect webhook is claimed for processing'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.fail_stripe_connect_event('evt_connect_retry', 'Transient Stripe failure')$$,
  'A failed Connect webhook is retained for retry'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_connect_event(
    'evt_connect_retry', 'v2.core.account.updated', 'acct_integrity')),
  'process',
  'A failed Connect webhook is claimed again'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.complete_stripe_connect_event('evt_connect_retry', 'completed')$$,
  'A successful Connect webhook becomes terminal'
);
insert into tap_results (result) select is(
  (select action from ceaute.claim_stripe_connect_event(
    'evt_connect_retry', 'v2.core.account.updated', 'acct_integrity')),
  'complete',
  'A completed Connect webhook replay is idempotent'
);

insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
