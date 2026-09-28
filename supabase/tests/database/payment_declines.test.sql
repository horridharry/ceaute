begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(10);

create temp table tap_results (result text);
grant insert, select on table tap_results to service_role;

-- Two held bookings on open Checkout pages. The first has no PaymentIntent
-- yet, as every Checkout Session has until the customer pays. The second
-- already has one recorded.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09400000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'decline-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09400000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'decline-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, status)
values ('19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000002', 'decline.studio', 'Decline Studio', 'draft');

insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence, is_active)
values ('29400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001', 'Declined manicure', 'Fixture', 60, 5000, true);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, service_snapshot
)
select
  ('39400000-0000-0000-0000-00000000000' || n)::uuid,
  '09400000-0000-0000-0000-000000000001',
  '19400000-0000-0000-0000-000000000001',
  '29400000-0000-0000-0000-000000000001',
  now() + make_interval(days => n),
  now() + make_interval(days => n, hours => 1),
  'awaiting_payment',
  now() + interval '30 minutes',
  jsonb_build_object('treatment_name', 'Declined manicure', 'total_price_pence', 5000)
from generate_series(1, 2) as n;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_checkout_expires_at, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values
  ('59400000-0000-0000-0000-000000000001', '39400000-0000-0000-0000-000000000001', 1,
   'ceaute-checkout-decline-1', 'cs_decline_1', now() + interval '30 minutes', null,
   1500, 5000, 3500, 55, 'checkout_created', 'acct_decline'),
  ('59400000-0000-0000-0000-000000000002', '39400000-0000-0000-0000-000000000002', 1,
   'ceaute-checkout-decline-2', 'cs_decline_2', now() + interval '30 minutes', 'pi_decline_recorded',
   1500, 5000, 3500, 55, 'checkout_created', 'acct_decline');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- payment_intent.payment_failed, as the webhook passes it: no Session, the
-- event's PaymentIntent, not expired.
insert into tap_results select lives_ok(
  $$select ceaute.mark_booking_payment_attempt_failed(
      '59400000-0000-0000-0000-000000000001', null, 'pi_decline_first_try',
      'Payment failed.', false)$$,
  'A decline is accepted while the attempt has no PaymentIntent recorded');

insert into tap_results select is(
  (select row(payment_status, failure_reason, stripe_payment_intent_id)::text
   from ceaute.booking_payment_attempt where id = '59400000-0000-0000-0000-000000000001'),
  '(failed,"Payment failed.",)',
  'The decline is recorded as failed, without storing the declined PaymentIntent');

insert into tap_results select is(
  (select status from ceaute.booking where id = '39400000-0000-0000-0000-000000000001'),
  'awaiting_payment',
  'A decline keeps the customer''s time held');

insert into tap_results select lives_ok(
  $$select ceaute.mark_booking_payment_attempt_failed(
      '59400000-0000-0000-0000-000000000001', null, 'pi_decline_first_try',
      'Payment was cancelled.', false)$$,
  'payment_intent.canceled without a recorded PaymentIntent is accepted too');

-- The customer tries again on the same page. Stripe does not promise the
-- same PaymentIntent, so the successful one may differ from the declined one.
insert into tap_results select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
      '59400000-0000-0000-0000-000000000001', 'pi_decline_second_try', 'cs_decline_1',
      'paid', 'gbp', 1500)),
  'confirmed',
  'A later payment on the same page confirms the booking, whichever PaymentIntent it uses');

insert into tap_results select lives_ok(
  $$select ceaute.mark_booking_payment_attempt_failed(
      '59400000-0000-0000-0000-000000000001', null, 'pi_decline_second_try',
      'Payment failed.', false)$$,
  'A stale decline after the payment succeeded is acknowledged');

reset role;

insert into tap_results select is(
  (select row(payment_status, stripe_payment_intent_id)::text
   from ceaute.booking_payment_attempt where id = '59400000-0000-0000-0000-000000000001'),
  '(succeeded,pi_decline_second_try)',
  'The stale decline does not downgrade the succeeded payment');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_ok(
  $$select ceaute.mark_booking_payment_attempt_failed(
      '59400000-0000-0000-0000-000000000002', null, 'pi_decline_other',
      'Payment failed.', false)$$,
  'P0001', 'Stripe PaymentIntent does not match the payment attempt.',
  'A decline naming a different PaymentIntent than the recorded one is rejected');

insert into tap_results select throws_ok(
  $$select ceaute.mark_booking_payment_attempt_failed(
      '59400000-0000-0000-0000-000000000002', 'cs_decline_other', null,
      'Checkout session expired.', true)$$,
  'P0001', 'Stripe Checkout Session does not match the payment attempt.',
  'An expiry naming a different Checkout Session is still rejected');

reset role;

insert into tap_results select is(
  (select row(payment_status, stripe_payment_intent_id)::text
   from ceaute.booking_payment_attempt where id = '59400000-0000-0000-0000-000000000002'),
  '(checkout_created,pi_decline_recorded)',
  'The rejected events leave that attempt untouched');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
