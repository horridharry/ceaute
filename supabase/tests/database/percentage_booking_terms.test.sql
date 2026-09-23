begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(57);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

-- The rule, defined once (docs/decisions/006-percentage-booking-terms.md) --------
-- Specification §4.3, rows E1-E10: price, mode, percentage -> pay now, later,
-- kept after a late customer cancellation.
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(4725, 'deposit', 30)),
  '(1418,3307,1418)', 'E1: 30% deposit of £47.25 is £14.18 now (1417.5p rounds up)');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(4725, 'full', 30)),
  '(4725,0,1418)', 'E2: full payment of £47.25 keeps £14.18 after a late cancellation');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(800, 'deposit', 10)),
  '(100,700,80)', 'E3: the £1 minimum applies, but a late cancellation keeps only the 10%');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(100, 'deposit', 10)),
  '(100,0,10)', 'E4: the minimum never exceeds the whole price');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(3333, 'deposit', 25)),
  '(833,2500,833)', 'E5: 25% of £33.33 is £8.33');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(1230, 'deposit', 15)),
  '(185,1045,185)', 'E6: 184.5p rounds half up to £1.85');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(6000, 'full', 100)),
  '(6000,0,6000)', 'E7: full payment keeping 100% refunds nothing after a late cancellation');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(4500, 'deposit', 90)),
  '(4050,450,4050)', 'E8: a 90% deposit');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(1995, 'full', 10)),
  '(1995,0,200)', 'E9: 199.5p kept rounds half up to £2.00');
insert into tap_results select is(
  (select row(amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.booking_payment_terms(4999, 'deposit', 50)),
  '(2500,2499,2500)', 'E10: 2499.5p rounds half up to £25.00');

insert into tap_results select throws_matching(
  $$select * from ceaute.booking_payment_terms(4000, 'deposit', 5)$$,
  'Invalid booking payment terms', 'A deposit below 10% is refused');
insert into tap_results select throws_matching(
  $$select * from ceaute.booking_payment_terms(4000, 'deposit', 95)$$,
  'Invalid booking payment terms', 'A deposit above 90% is refused');
insert into tap_results select throws_matching(
  $$select * from ceaute.booking_payment_terms(4000, 'full', 12)$$,
  'Invalid booking payment terms', 'A percentage off the 5% steps is refused');
insert into tap_results select throws_matching(
  $$select * from ceaute.booking_payment_terms(4000, 'fixed_deposit', 30)$$,
  'Invalid booking payment terms', 'The legacy fixed-deposit mode has no percentage rule');
insert into tap_results select throws_matching(
  $$select * from ceaute.booking_payment_terms(-1, 'full', 30)$$,
  'Invalid booking payment terms', 'A negative price is refused');

-- Fixtures ------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'pct-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'pct-deposit@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'pct-full@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Percentage Test', phone_e164 = '+447700900911'
where id::text like '09100000-%';

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, provider_category, status
)
values
  ('19100000-0000-0000-0000-000000000001', '09100000-0000-0000-0000-000000000002', 'pct.deposit', 'Deposit Studio', 'Nails', 'published'),
  ('19100000-0000-0000-0000-000000000002', '09100000-0000-0000-0000-000000000003', 'pct.full', 'Full Studio', 'Nails', 'published');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
select id, 'Peckham, London', '1 Private Road', 'London', 'SE15 1AA', 'Ring twice', true
from ceaute.provider_page where id::text like '19100000-%';

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent, cancellation_window_hours, written_policy
)
values
  ('19100000-0000-0000-0000-000000000001', 'deposit', 30, 24, 'Deposit policy'),
  ('19100000-0000-0000-0000-000000000002', 'full', 30, 24, 'Full policy');

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
values
  ('19100000-0000-0000-0000-000000000001', 'acct_pct_deposit', true, 'active', 'active'),
  ('19100000-0000-0000-0000-000000000002', 'acct_pct_full', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values
  ('19100000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '09100000-0000-0000-0000-000000000002'),
  ('19100000-0000-0000-0000-000000000002', ceaute.current_provider_agreement_version(), '09100000-0000-0000-0000-000000000003');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select provider_page.id, weekday, '09:00', '17:00'
from ceaute.provider_page, generate_series(0, 6) as weekday
where provider_page.id::text like '19100000-%';

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
values
  ('29100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', 'Deposit treatment', null, 60, 4725,
   (select id from ceaute.discovery_category order by display_order limit 1), true),
  ('29100000-0000-0000-0000-000000000002', '19100000-0000-0000-0000-000000000001', 'Eight pound treatment', null, 30, 800,
   (select id from ceaute.discovery_category order by display_order limit 1), true),
  ('29100000-0000-0000-0000-000000000003', '19100000-0000-0000-0000-000000000002', 'Full treatment', 'Optional descriptions stay optional', 60, 4725,
   (select id from ceaute.discovery_category order by display_order limit 1), true);

create temp table pct_times as
select
  ((((now() at time zone 'Europe/London')::date + n)::timestamp + time '12:00') at time zone 'Europe/London') as start_at,
  n
from generate_series(3, 8) as n;
grant select on table pct_times to authenticated, service_role;

-- Settings: new writes must be complete percentage terms -----------------------------
insert into tap_results select throws_matching(
  $$update ceaute.provider_booking_setting set deposit_percent = 95
    where provider_page_id = '19100000-0000-0000-0000-000000000001'$$,
  'provider_booking_setting_percentage_terms', 'A 95% deposit cannot be saved');
insert into tap_results select throws_matching(
  $$update ceaute.provider_booking_setting set commitment_amount_pence = 1500
    where provider_page_id = '19100000-0000-0000-0000-000000000001'$$,
  'provider_booking_setting_percentage_terms', 'A fixed £ amount cannot be saved beside a percentage');
insert into tap_results select throws_matching(
  $$update ceaute.provider_booking_setting set cancellation_window_hours = null
    where provider_page_id = '19100000-0000-0000-0000-000000000001'$$,
  'provider_booking_setting_percentage_terms', 'A blank cancellation window cannot be saved');
insert into tap_results select throws_matching(
  $$insert into ceaute.treatment (provider_page_id, name, duration_minutes, price_pence, is_active)
    values ('19100000-0000-0000-0000-000000000001', 'Too cheap', 15, 99, true)$$,
  'treatment_price_at_least_one_pound', 'A new treatment must cost at least £1');

-- Holds snapshot the percentage terms and last ten minutes ---------------------------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table deposit_hold as
select ceaute.create_validated_booking_hold(
  '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001',
  '29100000-0000-0000-0000-000000000001', array[]::uuid[],
  (select start_at from pct_times where n = 3)
) as id;

create temp table full_hold as
select ceaute.create_validated_booking_hold(
  '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000002',
  '29100000-0000-0000-0000-000000000003', array[]::uuid[],
  (select start_at from pct_times where n = 3)
) as id;

reset role;

insert into tap_results select is(
  (select service_snapshot ->> 'payment_mode' from ceaute.booking where id = (select id from deposit_hold)),
  'deposit', 'The hold snapshots deposit mode');
insert into tap_results select is(
  (select (service_snapshot ->> 'deposit_percent')::integer from ceaute.booking where id = (select id from deposit_hold)),
  30, 'The hold snapshots the percentage');
insert into tap_results select is(
  (select (service_snapshot ->> 'amount_due_now_pence')::bigint from ceaute.booking where id = (select id from deposit_hold)),
  1418::bigint, 'The hold snapshots what is due now (E1)');
insert into tap_results select is(
  (select (service_snapshot ->> 'commitment_amount_pence')::bigint from ceaute.booking where id = (select id from deposit_hold)),
  1418::bigint, 'The hold snapshots what a late cancellation keeps (E1)');
insert into tap_results select is(
  (select (service_snapshot ->> 'total_price_pence')::bigint from ceaute.booking where id = (select id from deposit_hold)),
  4725::bigint, 'The hold snapshots the whole price');
insert into tap_results select ok(
  (select expires_at between now() + interval '9 minutes 55 seconds' and now() + interval '10 minutes 5 seconds'
   from ceaute.booking where id = (select id from deposit_hold)),
  'A new hold lasts ten minutes');
insert into tap_results select is(
  (select row(service_snapshot ->> 'payment_mode', service_snapshot ->> 'amount_due_now_pence', service_snapshot ->> 'commitment_amount_pence')::text
   from ceaute.booking where id = (select id from full_hold)),
  '(full,4725,1418)', 'A full-payment hold charges the whole price and keeps 30% after a late cancellation (E2)');

-- A later settings change never rewrites a hold that exists.
update ceaute.provider_booking_setting set deposit_percent = 10
where provider_page_id = '19100000-0000-0000-0000-000000000001';

insert into tap_results select is(
  (select (service_snapshot ->> 'amount_due_now_pence')::bigint from ceaute.booking where id = (select id from deposit_hold)),
  1418::bigint, 'Changing the percentage leaves the existing hold''s snapshot alone');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table minimum_hold as
select ceaute.create_validated_booking_hold(
  '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001',
  '29100000-0000-0000-0000-000000000002', array[]::uuid[],
  (select start_at from pct_times where n = 4)
) as id;

reset role;

insert into tap_results select is(
  (select row(service_snapshot ->> 'deposit_percent', service_snapshot ->> 'amount_due_now_pence', service_snapshot ->> 'commitment_amount_pence')::text
   from ceaute.booking where id = (select id from minimum_hold)),
  '(10,100,80)', 'An £8 booking at 10% pays the £1 minimum and keeps 80p after a late cancellation (E3)');

-- Checkout charges exactly the snapshot, and the Checkout extension ----------------------
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_matching(
  $$select * from ceaute.claim_booking_checkout(
    (select id from deposit_hold), 4725, 4725, 0, 180, 'gbp', 'acct_pct_deposit',
    'https://example.test/s', 'https://example.test/c')$$,
  'no longer matches authoritative booking terms',
  'Checkout refuses to charge the whole price for a deposit hold');
insert into tap_results select throws_matching(
  $$select * from ceaute.claim_booking_checkout(
    (select id from deposit_hold), 1417, 4725, 3308, 69, 'gbp', 'acct_pct_deposit',
    'https://example.test/s', 'https://example.test/c')$$,
  'no longer matches authoritative booking terms',
  'Checkout refuses an amount a penny off the snapshot');

create temp table original_expiry as
select expires_at from ceaute.booking where id = (select id from deposit_hold);

create temp table deposit_claim as
select * from ceaute.claim_booking_checkout(
  (select id from deposit_hold), 1418, 4725, 3307, 69, 'gbp', 'acct_pct_deposit',
  'https://example.test/s', 'https://example.test/c');

insert into tap_results select is((select action from deposit_claim), 'create',
  'Checkout is claimed for the snapshot amount');
insert into tap_results select is(
  (select (checkout_request_payload -> 'line_items' -> 0 -> 'price_data' ->> 'unit_amount')::bigint from deposit_claim),
  1418::bigint, 'Stripe is asked for exactly the deposit');
insert into tap_results select is(
  (select checkout_request_payload ->> 'customer_email' from deposit_claim),
  'pct-customer@example.test', 'Stripe receives the customer''s email');
insert into tap_results select ok(
  (select expires_at between now() + interval '30 minutes 55 seconds' and now() + interval '31 minutes 5 seconds'
   from ceaute.booking where id = (select id from deposit_hold)),
  'Opening Checkout extends the hold to the Checkout request''s 31 minutes');

select ceaute.reject_booking_checkout_creation(
  (select payment_attempt_id from deposit_claim),
  (select claim_token from deposit_claim),
  'Stripe refused the request'
);

insert into tap_results select is(
  (select expires_at from ceaute.booking where id = (select id from deposit_hold)),
  (select expires_at from original_expiry),
  'A refused Checkout returns the hold to its original ten minutes');

create temp table second_claim as
select * from ceaute.claim_booking_checkout(
  (select id from deposit_hold), 1418, 4725, 3307, 69, 'gbp', 'acct_pct_deposit',
  'https://example.test/s', 'https://example.test/c');

select ceaute.record_booking_checkout_session(
  (select payment_attempt_id from second_claim),
  (select claim_token from second_claim),
  'cs_pct_deposit', 'pi_pct_deposit', 'https://checkout.stripe.test/pct',
  (select to_timestamp((checkout_request_payload ->> 'expires_at')::bigint) from second_claim)
);

insert into tap_results select is(
  (select expires_at from ceaute.booking where id = (select id from deposit_hold)),
  (select to_timestamp((checkout_request_payload ->> 'expires_at')::bigint) from second_claim),
  'Recording the Session holds the time exactly until Stripe''s expiry');

create temp table reuse_claim as
select * from ceaute.claim_booking_checkout(
  (select id from deposit_hold), 1418, 4725, 3307, 69, 'gbp', 'acct_pct_deposit',
  'https://example.test/s', 'https://example.test/c');

insert into tap_results select is(
  (select row(action, stripe_checkout_url)::text from reuse_claim),
  '(reuse,https://checkout.stripe.test/pct)', 'Resuming a live hold reuses the open Session');

reset role;

-- Cancellation outcomes from the snapshot ---------------------------------------------
-- Confirmed bookings with the snapshots a hold writes (and two older shapes),
-- each paid by one succeeded attempt.
insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, confirmed_at, customer_snapshot, service_snapshot
)
values
  -- Deposit E1, starting in 12 hours: late.
  ('39100000-0000-0000-0000-000000000001', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', '29100000-0000-0000-0000-000000000001',
   now() + interval '12 hours', now() + interval '13 hours', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"deposit","deposit_percent":30,"amount_due_now_pence":1418,"commitment_amount_pence":1418,"total_price_pence":4725,"cancellation_window_hours":24}'),
  -- Full E2, starting in 13 hours: late.
  ('39100000-0000-0000-0000-000000000002', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000002', '29100000-0000-0000-0000-000000000003',
   now() + interval '13 hours', now() + interval '14 hours', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"full","deposit_percent":30,"amount_due_now_pence":4725,"commitment_amount_pence":1418,"total_price_pence":4725,"cancellation_window_hours":24}'),
  -- Full E2, starting in 5 days: early.
  ('39100000-0000-0000-0000-000000000003', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000002', '29100000-0000-0000-0000-000000000003',
   now() + interval '5 days', now() + interval '5 days 1 hour', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"full","deposit_percent":30,"amount_due_now_pence":4725,"commitment_amount_pence":1418,"total_price_pence":4725,"cancellation_window_hours":24}'),
  -- Full E2, starting in 16 hours, cancelled by the provider.
  ('39100000-0000-0000-0000-000000000004', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000002', '29100000-0000-0000-0000-000000000003',
   now() + interval '16 hours', now() + interval '17 hours', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"full","deposit_percent":30,"amount_due_now_pence":4725,"commitment_amount_pence":1418,"total_price_pence":4725,"cancellation_window_hours":24}'),
  -- Minimum E3, starting in 15 hours: late.
  ('39100000-0000-0000-0000-000000000005', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', '29100000-0000-0000-0000-000000000002',
   now() + interval '15 hours', now() + interval '15 hours 30 minutes', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"deposit","deposit_percent":10,"amount_due_now_pence":100,"commitment_amount_pence":80,"total_price_pence":800,"cancellation_window_hours":24}'),
  -- Historical full payment with a blank retained amount, starting in 18 hours: late.
  ('39100000-0000-0000-0000-000000000006', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', '29100000-0000-0000-0000-000000000001',
   now() + interval '18 hours', now() + interval '19 hours', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"full","commitment_amount_pence":null,"total_price_pence":5000,"cancellation_window_hours":24}'),
  -- Historical fixed £15 deposit, starting in 20 hours: late.
  ('39100000-0000-0000-0000-000000000007', '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001', '29100000-0000-0000-0000-000000000001',
   now() + interval '20 hours', now() + interval '21 hours', 'confirmed', now() - interval '1 day', '{"email":"pct-customer@example.test"}',
   '{"payment_mode":"fixed_deposit","commitment_amount_pence":1500,"total_price_pence":4500,"cancellation_window_hours":24}');

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values
  ('59100000-0000-0000-0000-000000000001', '39100000-0000-0000-0000-000000000001', 1, 'ceaute-checkout-pct-1', 'cs_pct_1', 'pi_pct_1', 1418, 4725, 3307, 69, 'succeeded', 'acct_pct_deposit'),
  ('59100000-0000-0000-0000-000000000002', '39100000-0000-0000-0000-000000000002', 1, 'ceaute-checkout-pct-2', 'cs_pct_2', 'pi_pct_2', 4725, 4725, 0, 186, 'succeeded', 'acct_pct_full'),
  ('59100000-0000-0000-0000-000000000003', '39100000-0000-0000-0000-000000000003', 1, 'ceaute-checkout-pct-3', 'cs_pct_3', 'pi_pct_3', 4725, 4725, 0, 186, 'succeeded', 'acct_pct_full'),
  ('59100000-0000-0000-0000-000000000004', '39100000-0000-0000-0000-000000000004', 1, 'ceaute-checkout-pct-4', 'cs_pct_4', 'pi_pct_4', 4725, 4725, 0, 186, 'succeeded', 'acct_pct_full'),
  ('59100000-0000-0000-0000-000000000005', '39100000-0000-0000-0000-000000000005', 1, 'ceaute-checkout-pct-5', 'cs_pct_5', 'pi_pct_5', 100, 800, 700, 24, 'succeeded', 'acct_pct_deposit'),
  ('59100000-0000-0000-0000-000000000006', '39100000-0000-0000-0000-000000000006', 1, 'ceaute-checkout-pct-6', 'cs_pct_6', 'pi_pct_6', 5000, 5000, 0, 195, 'succeeded', 'acct_pct_deposit'),
  ('59100000-0000-0000-0000-000000000007', '39100000-0000-0000-0000-000000000007', 1, 'ceaute-checkout-pct-7', 'cs_pct_7', 'pi_pct_7', 1500, 4500, 3000, 73, 'succeeded', 'acct_pct_deposit');

update ceaute.booking
set confirming_payment_attempt_id = ('59100000' || substr(id::text, 9))::uuid
where id::text like '39100000-%';

set local role authenticated;
select set_config('request.jwt.claim.sub', '09100000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table customer_outcomes as
select booking.id, outcome.refund_amount_pence, outcome.retained_amount_pence
from (values
  ('39100000-0000-0000-0000-000000000001'::uuid),
  ('39100000-0000-0000-0000-000000000002'::uuid),
  ('39100000-0000-0000-0000-000000000003'::uuid),
  ('39100000-0000-0000-0000-000000000005'::uuid),
  ('39100000-0000-0000-0000-000000000006'::uuid),
  ('39100000-0000-0000-0000-000000000007'::uuid)
) as booking(id)
cross join lateral ceaute.prepare_booking_cancellation(booking.id, 'customer') as outcome;

select set_config('request.jwt.claim.sub', '09100000-0000-0000-0000-000000000003', true);

create temp table provider_outcome as
select * from ceaute.prepare_booking_cancellation('39100000-0000-0000-0000-000000000004', 'provider');

reset role;

insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000001'),
  '(0,1418)', 'Late cancellation of a 30% deposit keeps the whole deposit');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000002'),
  '(3307,1418)', 'Late cancellation of a full payment keeps 30% and refunds the rest');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000003'),
  '(4725,0)', 'Early cancellation refunds everything paid');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from provider_outcome),
  '(4725,0)', 'A provider cancellation refunds everything, even inside the window');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000005'),
  '(20,80)', 'Late cancellation after the £1 minimum keeps only the percentage');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000006'),
  '(5000,0)', 'A historical full payment with a blank retained amount keeps £0 (the database''s real outcome)');
insert into tap_results select is(
  (select row(refund_amount_pence, retained_amount_pence)::text from customer_outcomes where id = '39100000-0000-0000-0000-000000000007'),
  '(0,1500)', 'A historical fixed £15 deposit keeps £15 after a late cancellation');
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_refund_operation where booking_id::text like '39100000-%' and purpose = 'cancellation'),
  5, 'A refund operation exists exactly where money is refunded');

-- Legacy settings are kept, never converted, and no longer count as complete ------------
-- Rows saved before 202609230001 bypassed the new check. Recreate one by
-- lifting the check for this transaction only.
alter table ceaute.provider_booking_setting drop constraint provider_booking_setting_percentage_terms;
update ceaute.provider_booking_setting
set payment_mode = 'fixed_deposit', commitment_amount_pence = 4500, deposit_percent = null
where provider_page_id = '19100000-0000-0000-0000-000000000001';
alter table ceaute.provider_booking_setting
  add constraint provider_booking_setting_percentage_terms check (
    ceaute.booking_terms_are_complete(payment_mode, deposit_percent, cancellation_window_hours)
    and commitment_amount_pence is null
  ) not valid;

insert into tap_results select is(
  (select row(payment_mode, commitment_amount_pence, deposit_percent)::text
   from ceaute.provider_booking_setting where provider_page_id = '19100000-0000-0000-0000-000000000001'),
  '(fixed_deposit,4500,)', 'A legacy £45 deposit is kept as it was, not converted');
insert into tap_results select is(
  (select has_booking_terms from ceaute.provider_page_publication_check_values('19100000-0000-0000-0000-000000000001')),
  false, 'A legacy fixed deposit does not count as complete booking terms');
insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19100000-0000-0000-0000-000000000001'),
  false, 'A live page with legacy terms takes no new bookings');
insert into tap_results select is(
  (select status from ceaute.provider_page where id = '19100000-0000-0000-0000-000000000001'),
  'published', 'It is not unpublished');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '09100000-0000-0000-0000-000000000001', '19100000-0000-0000-0000-000000000001',
    '29100000-0000-0000-0000-000000000001', (select start_at from pct_times where n = 6)
  ),
  'Provider is not taking bookings', 'A hold is refused until a percentage is chosen');

insert into tap_results select is(
  (select row(accepts_new_bookings, amount_due_now_pence)::text
   from ceaute.get_public_booking_terms('19100000-0000-0000-0000-000000000001', 4725)),
  '(f,)', 'The public quote says a legacy provider is not taking bookings and quotes nothing');

insert into tap_results select is(
  (select (service_snapshot ->> 'amount_due_now_pence')::bigint from ceaute.booking where id = (select id from deposit_hold)),
  1418::bigint, 'A hold made before the change keeps its terms');

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '09100000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select throws_matching(
  $$update ceaute.provider_booking_setting set written_policy = 'Edited'
    where provider_page_id = '19100000-0000-0000-0000-000000000001'$$,
  'provider_booking_setting_percentage_terms',
  'Saving a legacy row again requires choosing a percentage');
insert into tap_results select lives_ok(
  $$update ceaute.provider_booking_setting
    set payment_mode = 'deposit', deposit_percent = 25, commitment_amount_pence = null
    where provider_page_id = '19100000-0000-0000-0000-000000000001'$$,
  'The owner can choose a percentage');

reset role;

insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19100000-0000-0000-0000-000000000001'),
  true, 'Choosing a percentage resumes bookings at once');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select is(
  (select row(accepts_new_bookings, amount_due_now_pence, amount_due_later_pence, late_cancellation_retained_pence)::text
   from ceaute.get_public_booking_terms('19100000-0000-0000-0000-000000000001', 3333)),
  '(t,833,2500,833)', 'The public quote uses the same rule as the hold (E5)');
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_booking_terms('19100000-0000-0000-0000-000000000001', 99)
   where accepts_new_bookings),
  0, 'A price below £1 is never quoted as payable');

reset role;

insert into tap_results select * from finish();
select result from tap_results;
rollback;
