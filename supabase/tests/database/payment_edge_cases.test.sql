begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(25);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'edge-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '02000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'edge-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Payment Edge Test', phone_e164 = '+447700900222'
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
  'payment.edge', 'Payment Edge Provider', 'Edge-case fixture', 'Nails', 'published'
);

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('12000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '02000000-0000-0000-0000-000000000002');

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
values (
  '22000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'Edge treatment', 'Test treatment', 60, 5000,
  (select id from ceaute.discovery_category order by display_order limit 1), true
);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, customer_snapshot, service_snapshot
)
values
  (
    '32000000-0000-0000-0000-000000000001',
    '02000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    now() + interval '10 days', now() + interval '10 days 1 hour',
    'awaiting_payment', now() + interval '5 minutes', '{}',
    '{"provider_display_name":"Edge Provider","treatment_name":"Edge treatment","cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '32000000-0000-0000-0000-000000000002',
    '02000000-0000-0000-0000-000000000001',
    '12000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000001',
    now() + interval '11 days', now() + interval '11 days 1 hour',
    'awaiting_payment', now() + interval '5 minutes', '{}',
    '{"provider_display_name":"Edge Provider","treatment_name":"Edge treatment"}'
  );

create temp table second_original_expiry as
select expires_at from ceaute.booking
where id = '32000000-0000-0000-0000-000000000002';
grant select on table second_original_expiry to service_role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table first_claim as
select * from ceaute.claim_booking_checkout(
  '32000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
  'gbp', 'acct_edge',
  'https://example.test/booking?checkout=success',
  'https://example.test/booking?checkout=cancelled'
);
grant select on table first_claim to authenticated, service_role;

insert into tap_results select is((select action from first_claim), 'create',
  'Checkout creation is durably claimed');
insert into tap_results select is(
  (select checkout_request_payload -> 'allowed_payment_method_types' ->> 0 from first_claim),
  'card', 'Checkout is restricted to immediate card payments');
insert into tap_results select is(
  (select expires_at from ceaute.booking where id = '32000000-0000-0000-0000-000000000001'),
  (select to_timestamp((checkout_request_payload ->> 'expires_at')::bigint) from first_claim),
  'The booking is reserved through the persisted Checkout creation window');

insert into tap_results select lives_ok(
  $$select ceaute.record_booking_checkout_creation_uncertain(
    (select payment_attempt_id from first_claim),
    (select claim_token from first_claim), 'Connection closed after request'
  )$$, 'An ambiguous Checkout result keeps the attempt retryable');

create temp table retry_claim as
select * from ceaute.claim_booking_checkout(
  '32000000-0000-0000-0000-000000000001', 5000, 5000, 0, 500,
  'gbp', 'acct_edge',
  'https://different.example.test/ignored-success',
  'https://different.example.test/ignored-cancel'
);

insert into tap_results select is(
  (select payment_attempt_id from retry_claim),
  (select payment_attempt_id from first_claim),
  'An uncertain retry reuses the same attempt');
insert into tap_results select is(
  (select checkout_idempotency_key from retry_claim),
  (select checkout_idempotency_key from first_claim),
  'An uncertain retry reuses the same idempotency key');
insert into tap_results select is(
  (select checkout_request_payload from retry_claim),
  (select checkout_request_payload from first_claim),
  'An uncertain retry reuses the byte-stable persisted request');

insert into tap_results select lives_ok(
  $$select ceaute.record_booking_checkout_session(
    (select payment_attempt_id from retry_claim),
    (select claim_token from retry_claim),
    'cs_edge_primary', null, 'https://checkout.stripe.test/edge',
    (select to_timestamp((checkout_request_payload ->> 'expires_at')::bigint) from retry_claim)
  )$$, 'The returned Checkout Session is attached once');
insert into tap_results select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_claim),
    'pi_edge_primary', 'cs_edge_primary', 'paid', 'gbp', 5000
  )), 'confirmed', 'The verified immediate card payment confirms the booking');

set local role authenticated;
select set_config('request.jwt.claim.sub', '02000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table cancellation as
select * from ceaute.prepare_booking_cancellation(
  '32000000-0000-0000-0000-000000000001', 'customer'
);
grant select on table cancellation to service_role;
insert into tap_results select is((select outcome from cancellation), 'cancelled',
  'The authorized cancellation creates its canonical refund operation');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from first_claim),
    'pi_edge_primary', 'cs_edge_primary', 'paid', 'gbp', 5000
  )), 'already_processed', 'Payment completion replay after cancellation is idempotent');

reset role;
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_refund_operation
    where booking_id = '32000000-0000-0000-0000-000000000001'
      and purpose = 'late_payment'),
  0, 'Payment completion replay does not create a late full refund');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temp table refund_claim as
select * from ceaute.claim_booking_refund_operation(
  (select refund_operation_id from cancellation)
);
insert into tap_results select is((select action from refund_claim), 'create',
  'The canonical cancellation refund receives one create attempt');

reset role;
update ceaute.booking_refund_operation
set status = 'pending', processing_started_at = null,
    create_attempted_at = now() - interval '24 hours'
where id = (select refund_operation_id from cancellation);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select is(
  (select action from ceaute.claim_booking_refund_operation(
    (select refund_operation_id from cancellation)
  )), 'requires_review', 'An unproven refund is not recreated after the safe idempotency window');

reset role;
insert into tap_results select is(
  (select status from ceaute.booking_refund_operation
    where id = (select refund_operation_id from cancellation)),
  'requires_review', 'The unknown refund outcome is durably marked for review');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select lives_ok(
  $$select ceaute.record_booking_refund_state(
    (select refund_operation_id from cancellation), 're_edge', 'pi_edge_primary',
    'ch_edge_primary', 5000, 'succeeded', null, 200
  )$$, 'An authoritative matching refund can resolve review');
insert into tap_results select lives_ok(
  $$select ceaute.record_booking_refund_state(
    (select refund_operation_id from cancellation), 're_edge', 'pi_edge_primary',
    'ch_edge_primary', 5000, 'pending', null, 100
  )$$, 'A stale pending refund event is ignored');

reset role;
insert into tap_results select is(
  (select status from ceaute.booking_refund_operation
    where id = (select refund_operation_id from cancellation)),
  'succeeded', 'A stale event cannot regress refund success');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select lives_ok(
  $$select ceaute.record_booking_refund_state(
    (select refund_operation_id from cancellation), 're_edge', 'pi_edge_primary',
    'ch_edge_primary', 5000, 'failed', 'late failure', 300
  )$$, 'A later terminal replay remains idempotent');

reset role;
insert into tap_results select is(
  (select status from ceaute.booking_refund_operation
    where id = (select refund_operation_id from cancellation)),
  'succeeded', 'Succeeded refunds never regress');

insert into tap_results select throws_matching(
  $$insert into ceaute.booking_refund_operation (
    booking_id, booking_payment_attempt_id, purpose, expected_amount_pence,
    idempotency_key, stripe_payment_intent_id
  ) values (
    '32000000-0000-0000-0000-000000000001',
    (select payment_attempt_id from first_claim), 'late_payment', 1,
    'ceaute-refund-over-entitlement', 'pi_edge_primary'
  )$$,
  'Total refund entitlement exceeds',
  'Refund operations cannot exceed the captured entitlement');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temp table rejected_claim as
select * from ceaute.claim_booking_checkout(
  '32000000-0000-0000-0000-000000000002', 5000, 5000, 0, 500,
  'gbp', 'acct_edge',
  'https://example.test/rejected-success',
  'https://example.test/rejected-cancel'
);
insert into tap_results select is((select action from rejected_claim), 'create',
  'A second booking receives an atomic Checkout claim');
insert into tap_results select lives_ok(
  $$select ceaute.reject_booking_checkout_creation(
    (select payment_attempt_id from rejected_claim),
    (select claim_token from rejected_claim), 'Stripe rejected parameters'
  )$$, 'A definite Stripe rejection retires the Checkout attempt');
insert into tap_results select is(
  (select expires_at from ceaute.booking where id = '32000000-0000-0000-0000-000000000002'),
  (select expires_at from second_original_expiry),
  'A definite rejection restores the original booking hold');
insert into tap_results select is(
  (select payment_status from ceaute.booking_payment_attempt
    where id = (select payment_attempt_id from rejected_claim)),
  'failed', 'A rejected Checkout attempt cannot become payable');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
