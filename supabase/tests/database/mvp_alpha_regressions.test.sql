begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(46);

-- Every assertion after the opening superuser block is written to tap_results
-- so the TAP lines are emitted in numeric order at the end.
create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

-- Accounts: a customer, two provider owners, two further owners for the
-- discovery fixtures, a second customer, and one owner with no page yet.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'regression-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'regression-provider-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'regression-provider-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'regression-draft-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'regression-nousername-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'regression-customer-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '07000000-0000-0000-0000-000000000007', 'authenticated', 'authenticated', 'regression-pageless-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Regression Test', phone_e164 = '+447700900888'
where id::text like '07000000-%';

-- Provider one: published, fully discoverable. Provider two: the other tenant.
-- Draft provider and no-username provider carry data identical to provider one.
insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('17000000-0000-0000-0000-000000000001', '07000000-0000-0000-0000-000000000002',
   'search.published', 'Published Search Provider', 'Fixture', 'Nails', 'published'),
  ('17000000-0000-0000-0000-000000000002', '07000000-0000-0000-0000-000000000003',
   'other.tenant', 'Other Tenant Provider', 'Fixture', 'Nails', 'draft'),
  ('17000000-0000-0000-0000-000000000003', '07000000-0000-0000-0000-000000000004',
   'search.draft', 'Draft Search Provider', 'Fixture', 'Nails', 'draft'),
  ('17000000-0000-0000-0000-000000000004', '07000000-0000-0000-0000-000000000005',
   null, 'No Username Provider', 'Fixture', 'Nails', 'published');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
values
  ('17000000-0000-0000-0000-000000000001', 'Testville Quarter', '7 Private Street', 'London', 'N1 1AA', 'Ring the bell', true),
  ('17000000-0000-0000-0000-000000000003', 'Testville Quarter', '7 Private Street', 'London', 'N1 1AA', 'Ring the bell', true),
  ('17000000-0000-0000-0000-000000000004', 'Testville Quarter', '7 Private Street', 'London', 'N1 1AA', 'Ring the bell', true);

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '17000000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.blocked_date (provider_page_id, local_date, reason)
values ('17000000-0000-0000-0000-000000000001', (now() at time zone 'Europe/London')::date + 20, 'Regression fixture');

insert into ceaute.treatment_group (id, provider_page_id, name)
values ('47000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', 'Hands');

insert into ceaute.portfolio_image (provider_page_id, storage_path, caption, is_visible)
values ('17000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001/regression.webp', 'Regression', true);

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
values
  ('27000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001',
   'Search manicure', 'Fixture', 60, 5000,
   (select id from ceaute.discovery_category where slug = 'manicure'), true),
  ('27000000-0000-0000-0000-000000000003', '17000000-0000-0000-0000-000000000003',
   'Search manicure', 'Fixture', 60, 5000,
   (select id from ceaute.discovery_category where slug = 'manicure'), true),
  ('27000000-0000-0000-0000-000000000004', '17000000-0000-0000-0000-000000000004',
   'Search manicure', 'Fixture', 60, 5000,
   (select id from ceaute.discovery_category where slug = 'manicure'), true);

-- Bookings, all on provider one and at non-overlapping times:
--   01 completed (customer one)            reviews: accepts one review
--   02 confirmed, future (customer one)    reviews: not yet reviewable
--   03 completed, customer = owner         reviews: owner cannot self-review
--   04 confirmed, elapsed                  completion: becomes completed
--   05 confirmed, future                   completion: stays confirmed
--   06 awaiting_payment, elapsed           completion: untouched
--   07 cancelled, elapsed                  completion: untouched
--   08 confirmed, 6 hours away, deposit    cancellation: late customer cancel
--   09 confirmed, 9 hours away, deposit    cancellation: provider cancel
--   10 completed                           cancellation: rejected
insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, confirmed_at, customer_snapshot, service_snapshot
)
values
  ('37000000-0000-0000-0000-000000000001', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '5 days', now() - interval '5 days' + interval '1 hour', 'completed', null, now() - interval '6 days',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000002', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() + interval '5 days', now() + interval '5 days' + interval '1 hour', 'confirmed', null, now() - interval '1 day',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000003', '07000000-0000-0000-0000-000000000002', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '6 days', now() - interval '6 days' + interval '1 hour', 'completed', null, now() - interval '7 days',
   '{"full_name":"Regression Test","email":"regression-provider-one@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000004', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '2 hours', now() - interval '1 hour', 'confirmed', null, now() - interval '1 day',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000005', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() + interval '3 days', now() + interval '3 days' + interval '1 hour', 'confirmed', null, now() - interval '1 day',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000006', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '5 hours', now() - interval '4 hours', 'awaiting_payment', now() - interval '4 hours 30 minutes', null,
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000007', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '8 hours', now() - interval '7 hours', 'cancelled', null, null,
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"full","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000008', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() + interval '6 hours', now() + interval '7 hours', 'confirmed', null, now() - interval '1 day',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"fixed_deposit","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000009', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() + interval '9 hours', now() + interval '10 hours', 'confirmed', null, now() - interval '1 day',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"fixed_deposit","cancellation_window_hours":24,"commitment_amount_pence":1000}'),
  ('37000000-0000-0000-0000-000000000010', '07000000-0000-0000-0000-000000000001', '17000000-0000-0000-0000-000000000001', '27000000-0000-0000-0000-000000000001',
   now() - interval '3 days', now() - interval '3 days' + interval '1 hour', 'completed', null, now() - interval '4 days',
   '{"full_name":"Regression Test","email":"regression-customer@example.test","phone":"+447700900888"}',
   '{"provider_display_name":"Published Search Provider","treatment_name":"Search manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Testville Quarter","address_line_1":"7 Private Street","city":"London","postcode":"N1 1AA","payment_mode":"fixed_deposit","cancellation_window_hours":24,"commitment_amount_pence":1000}');

-- Deposit payments for the two cancellable bookings: 1000 paid online of 5000.
insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values
  ('57000000-0000-0000-0000-000000000008', '37000000-0000-0000-0000-000000000008', 1,
   'ceaute-checkout-57000000-0000-0000-0000-000000000008', 'cs_regression_late', 'pi_regression_late',
   1000, 5000, 4000, 100, 'succeeded', 'acct_regression'),
  ('57000000-0000-0000-0000-000000000009', '37000000-0000-0000-0000-000000000009', 1,
   'ceaute-checkout-57000000-0000-0000-0000-000000000009', 'cs_regression_provider', 'pi_regression_provider',
   1000, 5000, 4000, 100, 'succeeded', 'acct_regression');

-- 1. Usernames. provider_page_username_unique is a plain (username) index and
-- provider_page_username_format only admits [a-z0-9._]{3,30}, so a different
-- case variant is rejected by the format check before the index is consulted.
select throws_matching(
  $$insert into ceaute.provider_page (owner_profile_id, username, display_name)
    values ('07000000-0000-0000-0000-000000000007', 'search.published', 'Duplicate')$$,
  'provider_page_username_unique',
  'A second page cannot take an existing username'
);
select throws_matching(
  $$insert into ceaute.provider_page (owner_profile_id, username, display_name)
    values ('07000000-0000-0000-0000-000000000007', 'Bad Name!', 'Malformed')$$,
  'provider_page_username_format',
  'A username outside [a-z0-9._]{3,30} is rejected'
);
select throws_matching(
  $$insert into ceaute.provider_page (owner_profile_id, username, display_name)
    values ('07000000-0000-0000-0000-000000000007', 'Search.Published', 'Different case')$$,
  'provider_page_username_format',
  'A different-case username is rejected by the lowercase format rule'
);

-- 2. Reviews.
select ok(
  not has_function_privilege('anon', 'ceaute.create_booking_review(uuid, integer, text)', 'EXECUTE'),
  'Anonymous visitors cannot create reviews'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  $$select ceaute.create_booking_review('37000000-0000-0000-0000-000000000002', 5, 'Too early')$$,
  'Only completed bookings can be reviewed',
  'A confirmed booking cannot be reviewed yet'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.create_booking_review('37000000-0000-0000-0000-000000000001', 0, null)$$,
  'Choose a rating from 1 to 5',
  'A rating of 0 is rejected'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.create_booking_review('37000000-0000-0000-0000-000000000001', 6, null)$$,
  'Choose a rating from 1 to 5',
  'A rating of 6 is rejected'
);

create temp table first_review as
select ceaute.create_booking_review(
  '37000000-0000-0000-0000-000000000001', 5, 'Lovely work'
) as id;

insert into tap_results (result) select ok(
  (select id from first_review) is not null,
  'A completed booking accepts a review'
);
insert into tap_results (result) select is(
  (select rating || ':' || comment from ceaute.booking_review
   where booking_id = '37000000-0000-0000-0000-000000000001'),
  '5:Lovely work',
  'The reviewing customer can read their rating and comment'
);
insert into tap_results (result) select is(
  (select ceaute.create_booking_review('37000000-0000-0000-0000-000000000001', 3, 'Second attempt')),
  (select id from first_review),
  'A second review of the same booking returns the existing review instead of a new one'
);

reset role;
insert into tap_results (result) select ok(
  (select count(*) = 1 and bool_and(rating = 5)
   from ceaute.booking_review
   where booking_id = '37000000-0000-0000-0000-000000000001'),
  'The booking keeps exactly one review with its original rating'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  $$select ceaute.create_booking_review('37000000-0000-0000-0000-000000000001', 4, null)$$,
  'Booking not found',
  'Another customer cannot review a booking by UUID'
);

select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000002', true);

insert into tap_results (result) select throws_matching(
  $$select ceaute.create_booking_review('37000000-0000-0000-0000-000000000003', 4, null)$$,
  'You cannot review your own provider page',
  'A provider owner cannot review a completed booking on their own page'
);

reset role;

-- 3. Automatic completion.
insert into tap_results (result) select ok(
  not has_function_privilege('authenticated', 'ceaute.complete_elapsed_bookings(integer)', 'EXECUTE'),
  'Signed-in users cannot run booking completion'
);
insert into tap_results (result) select ok(
  has_function_privilege('service_role', 'ceaute.complete_elapsed_bookings(integer)', 'EXECUTE'),
  'The backend can run booking completion'
);

create temp table elapsed_expected as
select count(*)::integer as expected_count
from ceaute.booking
where status = 'confirmed' and end_at <= now();

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table completion_result as
select ceaute.complete_elapsed_bookings(100) as completed_count;

reset role;
insert into tap_results (result) select is(
  (select completed_count from completion_result),
  (select expected_count from elapsed_expected),
  'Completion returns the number of elapsed confirmed bookings it completed'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = '37000000-0000-0000-0000-000000000004'),
  'completed',
  'An elapsed confirmed booking becomes completed'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = '37000000-0000-0000-0000-000000000005'),
  'confirmed',
  'A future confirmed booking stays confirmed'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = '37000000-0000-0000-0000-000000000006'),
  'awaiting_payment',
  'An elapsed unpaid hold is not completed'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = '37000000-0000-0000-0000-000000000007'),
  'cancelled',
  'An elapsed cancelled booking is not completed'
);

-- 4. Cancellation amounts. Booking 08 starts in 6 hours with a 24-hour window,
-- so the customer is late: retained = least(commitment 1000, paid 1000).
set local role authenticated;
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table late_cancellation as
select * from ceaute.prepare_booking_cancellation('37000000-0000-0000-0000-000000000008', 'customer');

insert into tap_results (result) select is(
  (select outcome from late_cancellation), 'cancelled',
  'A late customer cancellation still cancels the booking'
);
insert into tap_results (result) select is(
  (select amount_paid_pence || ':' || refund_amount_pence || ':' || retained_amount_pence from late_cancellation),
  '1000:0:1000',
  'A late customer cancellation retains the whole deposit and refunds nothing'
);
insert into tap_results (result) select ok(
  (select refund_operation_id is null and refund_status is null from late_cancellation),
  'A zero refund creates no refund operation'
);
insert into tap_results (result) select throws_matching(
  $$select * from ceaute.prepare_booking_cancellation('37000000-0000-0000-0000-000000000010', 'customer')$$,
  'Completed bookings cannot be cancelled',
  'A completed booking cannot be cancelled'
);

reset role;
insert into tap_results (result) select ok(
  (select payment_status = 'refunded' and refunded_at is not null
   from ceaute.booking_payment_attempt where id = '57000000-0000-0000-0000-000000000008'),
  'A fully retained deposit is recorded as refunded with nothing owed'
);
insert into tap_results (result) select is(
  (select cancelled_by || ':' || cancellation_refund_pence || ':' || cancellation_retained_pence
   from ceaute.booking where id = '37000000-0000-0000-0000-000000000008'),
  'customer:0:1000',
  'The booking records who cancelled and the retained deposit'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_refund_operation
   where booking_id = '37000000-0000-0000-0000-000000000008'),
  0,
  'No refund operation exists for a zero refund'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

create temp table provider_cancellation as
select * from ceaute.prepare_booking_cancellation('37000000-0000-0000-0000-000000000009', 'provider');

insert into tap_results (result) select is(
  (select outcome || ':' || amount_paid_pence || ':' || refund_amount_pence || ':' || retained_amount_pence
   from provider_cancellation),
  'cancelled:1000:1000:0',
  'A provider cancellation inside the window refunds the whole deposit'
);
insert into tap_results (result) select is(
  (select refund_status from provider_cancellation),
  'requested',
  'A provider cancellation creates a requested refund operation'
);

reset role;
insert into tap_results (result) select ok(
  (select count(*) = 1
   from ceaute.booking_refund_operation
   where booking_id = '37000000-0000-0000-0000-000000000009'
     and booking_payment_attempt_id = '57000000-0000-0000-0000-000000000009'
     and purpose = 'cancellation'
     and expected_amount_pence = 1000
     and stripe_payment_intent_id = 'pi_regression_provider'),
  'The refund operation carries the full deposit against the captured PaymentIntent'
);
insert into tap_results (result) select is(
  (select payment_status from ceaute.booking_payment_attempt
   where id = '57000000-0000-0000-0000-000000000009'),
  'refund_required',
  'The provider-cancelled payment awaits its refund'
);

-- 5. Discovery, called as an unrelated signed-in account.
set local role authenticated;
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select string_agg(username, ',')
   from ceaute.search_public_providers('Testville Quarter', 'manicure')
   where username in ('search.published', 'search.draft')),
  'search.published',
  'Area and category search returns the published provider and not the draft'
);
insert into tap_results (result) select is(
  (select string_agg(username, ',')
   from ceaute.search_public_providers('testville', null)
   where username in ('search.published', 'search.draft')),
  'search.published',
  'Area search is a case-insensitive substring match on the public area'
);
insert into tap_results (result) select ok(
  exists (select 1 from ceaute.search_public_providers(null, 'manicure') where username = 'search.published'),
  'Category search returns the published provider'
);
insert into tap_results (result) select ok(
  not exists (select 1 from ceaute.search_public_providers(null, 'manicure') where username = 'search.draft'),
  'Category search excludes the draft provider'
);
insert into tap_results (result) select ok(
  not exists (
    select 1 from ceaute.search_public_providers('Testville Quarter', null)
    where display_name = 'No Username Provider'
  ),
  'A page without a username is never listed'
);
insert into tap_results (result) select is(
  (select matching_treatments -> 0 ->> 'name'
   from ceaute.search_public_providers('Testville Quarter', 'manicure')
   where username = 'search.published'),
  'Search manicure',
  'The listing carries the matching treatment'
);

-- 6. Cross-tenant RLS, as provider two against provider one's rows.
select set_config('request.jwt.claim.sub', '07000000-0000-0000-0000-000000000003', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.treatment
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no treatments'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.treatment_group
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no treatment groups'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.availability_rule
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no working hours'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.blocked_date
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no blocked dates'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no location'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.portfolio_image
   where provider_page_id = '17000000-0000-0000-0000-000000000001'),
  0, 'Another provider sees no portfolio images'
);
insert into tap_results (result) select throws_matching(
  $$insert into ceaute.treatment (provider_page_id, name, description, duration_minutes, price_pence)
    values ('17000000-0000-0000-0000-000000000001', 'Hijacked treatment', 'Fixture', 30, 1000)$$,
  'row-level security policy',
  'Another provider cannot insert a treatment onto a page they do not own'
);
insert into tap_results (result) select lives_ok(
  $$update ceaute.treatment set name = 'Hijacked name'
    where id = '27000000-0000-0000-0000-000000000001'$$,
  'An update against another provider''s treatment runs without matching any row'
);

reset role;
insert into tap_results (result) select is(
  (select name from ceaute.treatment where id = '27000000-0000-0000-0000-000000000001'),
  'Search manicure'::varchar,
  'The other provider''s treatment is unchanged'
);

insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
