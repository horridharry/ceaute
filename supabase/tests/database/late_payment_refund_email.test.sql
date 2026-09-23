begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(10);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09300000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'late-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09300000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'late-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Late Payer', phone_e164 = '+447700900933'
where id::text like '09300000-%';

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, provider_category, status)
values ('19300000-0000-0000-0000-000000000001', '09300000-0000-0000-0000-000000000002', 'late.studio', 'Late Studio', 'Nails', 'published');

insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active)
values ('19300000-0000-0000-0000-000000000001', 'Hackney, London', '3 Secret Mews', 'London', 'E8 1AA', 'Side door', true);

insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, deposit_percent, cancellation_window_hours)
values ('19300000-0000-0000-0000-000000000001', 'deposit', 30, 24);

insert into ceaute.provider_payment_account (provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status)
values ('19300000-0000-0000-0000-000000000001', 'acct_late', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
values ('19300000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '09300000-0000-0000-0000-000000000002');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '19300000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (id, provider_page_id, name, duration_minutes, price_pence, is_active)
values ('29300000-0000-0000-0000-000000000001', '19300000-0000-0000-0000-000000000001', 'Late manicure', 60, 4000, true);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table late_hold as
select ceaute.create_validated_booking_hold(
  '09300000-0000-0000-0000-000000000001', '19300000-0000-0000-0000-000000000001',
  '29300000-0000-0000-0000-000000000001', array[]::uuid[],
  ((((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London')
) as id;

create temp table late_claim as
select * from ceaute.claim_booking_checkout(
  (select id from late_hold), 1200, 4000, 2800, 58, 'gbp', 'acct_late',
  'https://example.test/s', 'https://example.test/c');

select ceaute.record_booking_checkout_session(
  (select payment_attempt_id from late_claim), (select claim_token from late_claim),
  'cs_late', 'pi_late', 'https://checkout.stripe.test/late',
  (select to_timestamp((checkout_request_payload ->> 'expires_at')::bigint) from late_claim)
);

reset role;

-- The customer pays after the held time has run out.
update ceaute.booking set expires_at = now() - interval '1 minute'
where id = (select id from late_hold);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table late_completion as
select * from ceaute.complete_booking_payment_attempt(
  (select payment_attempt_id from late_claim), 'pi_late', 'cs_late', 'paid', 'gbp', 1200);

reset role;

-- The trigger is deferred to commit; make it fire now, as commit would.
set constraints booking_refund_operation_late_payment_email immediate;

insert into tap_results select is(
  (select outcome from late_completion), 'refund_required',
  'A payment after the hold ended becomes a refund, not a booking');
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type = 'late_payment_refunded_customer'),
  1, 'One late-payment refund email is queued');
insert into tap_results select is(
  (select row(recipient_email, recipient_role, delivery_status)::text from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type = 'late_payment_refunded_customer'),
  '(late-customer@example.test,customer,pending)', 'It goes to the customer who paid');
insert into tap_results select is(
  (select row((payload ->> 'amount_paid_pence')::bigint, (payload ->> 'refund_amount_pence')::bigint)::text
   from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type = 'late_payment_refunded_customer'),
  '(1200,1200)', 'It states the whole payment is refunded');
insert into tap_results select ok(
  (select not (payload ? 'address_line_1') and not (payload ? 'postcode') and not (payload ? 'access_instructions')
   from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type = 'late_payment_refunded_customer'),
  'It never carries the private address');
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type <> 'late_payment_refunded_customer'),
  0, 'No confirmation email is sent for a booking that was not made');

-- Stripe delivers the same event again.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
create temp table replayed_completion as
select * from ceaute.complete_booking_payment_attempt(
  (select payment_attempt_id from late_claim), 'pi_late', 'cs_late', 'paid', 'gbp', 1200);
reset role;

insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_refund_operation
   where booking_id = (select id from late_hold) and purpose = 'late_payment'),
  1, 'A replayed webhook records no second refund');
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from late_hold) and event_type = 'late_payment_refunded_customer'),
  1, 'A replayed webhook queues no second email');

-- Other refunds are not late payments.
insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, confirmed_at, cancelled_at, cancelled_by, customer_snapshot, service_snapshot
)
values (
  '39300000-0000-0000-0000-000000000002', '09300000-0000-0000-0000-000000000001',
  '19300000-0000-0000-0000-000000000001', '29300000-0000-0000-0000-000000000001',
  now() + interval '9 days', now() + interval '9 days 1 hour', 'cancelled',
  now() - interval '2 days', now(), 'provider',
  '{"email":"late-customer@example.test"}', '{"total_price_pence":4000}'
);
insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key, stripe_checkout_session_id,
  stripe_payment_intent_id, amount_charged_pence, total_booking_value_pence,
  amount_due_later_pence, ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values (
  '59300000-0000-0000-0000-000000000002', '39300000-0000-0000-0000-000000000002', 1,
  'ceaute-checkout-late-2', 'cs_late_2', 'pi_late_2', 1200, 4000, 2800, 58, 'refund_required', 'acct_late'
);
insert into ceaute.booking_refund_operation (
  booking_id, booking_payment_attempt_id, purpose, expected_amount_pence, idempotency_key
)
values (
  '39300000-0000-0000-0000-000000000002', '59300000-0000-0000-0000-000000000002',
  'cancellation', 1200, 'ceaute-refund-cancellation-late-2'
);

insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = '39300000-0000-0000-0000-000000000002' and event_type = 'late_payment_refunded_customer'),
  0, 'A cancellation refund does not send the late-payment email');

insert into tap_results select throws_matching(
  $$select ceaute.enqueue_late_payment_refund_email()$$,
  'trigger functions can only be called as triggers',
  'The enqueue function is a trigger only');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
