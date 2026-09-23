begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(6);

create temp table tap_results (result text);
grant insert, select on table tap_results to service_role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- What the payments webhook did before: record the event with the payment
-- attempt ID another environment put in the Checkout Session metadata.
insert into tap_results select throws_ok(
  $$select * from ceaute.claim_stripe_payment_event(
      'evt_foreign_expired_before', 'checkout.session.expired',
      '99999999-9999-4999-8999-999999999999', null)$$,
  '23503', null,
  'A foreign payment attempt ID fails the foreign key, which is why Stripe saw 500s');

-- What the webhook does now for a foreign failure event.
insert into tap_results select is(
  (select action from ceaute.claim_stripe_payment_event(
      'evt_foreign_expired', 'checkout.session.expired', null, null)),
  'process',
  'The same event claimed without the foreign attempt ID can be recorded');

insert into tap_results select lives_ok(
  $$select ceaute.complete_stripe_payment_event('evt_foreign_expired', 'ignored')$$,
  'A foreign failure event is completed as ignored');

reset role;

insert into tap_results select is(
  (select row(processing_status, booking_payment_attempt_id, attempt_count)::text
   from ceaute.stripe_payment_event where id = 'evt_foreign_expired'),
  '(ignored,,1)',
  'It is stored as ignored with no payment attempt');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select is(
  (select action from ceaute.claim_stripe_payment_event(
      'evt_foreign_expired', 'checkout.session.expired', null, null)),
  'complete',
  'A Stripe retry of the ignored event is acknowledged without reprocessing');

reset role;

insert into tap_results select is(
  (select attempt_count from ceaute.stripe_payment_event where id = 'evt_foreign_expired'),
  1,
  'The retry does not start another processing attempt');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
