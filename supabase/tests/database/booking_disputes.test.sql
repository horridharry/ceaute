begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(19);

-- One confirmed, paid booking to dispute, and a second one so the operator
-- listing has something to order and filter.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'dispute-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'dispute-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, status)
values ('19000000-0000-0000-0000-000000000001', '09000000-0000-0000-0000-000000000002', 'dispute.studio', 'Dispute Studio', 'draft');

insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence, is_active)
values ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'Disputed manicure', 'Fixture', 60, 5000, true);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, confirmed_at, service_snapshot
)
select
  ('39000000-0000-0000-0000-00000000000' || n)::uuid,
  '09000000-0000-0000-0000-000000000001',
  '19000000-0000-0000-0000-000000000001',
  '29000000-0000-0000-0000-000000000001',
  now() + make_interval(days => n),
  now() + make_interval(days => n, hours => 1),
  'confirmed',
  now() - interval '1 day',
  jsonb_build_object('treatment_name', 'Disputed manicure', 'total_price_pence', 5000)
from generate_series(1, 2) as n;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
select
  ('59000000-0000-0000-0000-00000000000' || n)::uuid,
  ('39000000-0000-0000-0000-00000000000' || n)::uuid,
  1,
  'ceaute-checkout-dispute-' || n,
  'cs_dispute_' || n,
  'pi_dispute_' || n,
  1000, 5000, 4000, 55, 'succeeded', 'acct_dispute'
from generate_series(1, 2) as n;

-- Only the trusted backend may touch disputes.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Execute is revoked outright, so a signed-in user is stopped by the grant
-- before the in-function role guard is ever reached. Both layers exist; this
-- asserts the outer one, which is the one that actually fires.
select throws_ok(
  $$select * from ceaute.record_stripe_dispute('dp_x', 'ch_x', 'pi_dispute_1', 1000, 'gbp', 'needs_response', 'fraudulent', null, 'created', 'ops@example.test')$$,
  '42501',
  'permission denied for function record_stripe_dispute',
  'a signed-in user cannot record a dispute'
);

select throws_ok(
  $$select * from ceaute.list_booking_disputes()$$,
  '42501',
  'permission denied for function list_booking_disputes',
  'a signed-in user cannot list disputes'
);

select throws_ok(
  $$select 1 from ceaute.booking_dispute$$,
  '42501',
  'permission denied for table booking_dispute',
  'the dispute table is unreadable without the service role'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- A dispute opens against booking 1.
select is(
  (select out_emails_enqueued from ceaute.record_stripe_dispute(
    'dp_open_1', 'ch_dispute_1', 'pi_dispute_1', 1000, 'gbp',
    'needs_response', 'fraudulent', now() + interval '7 days', 'created',
    'ops@example.test'
  )),
  1,
  'opening a dispute enqueues exactly one operator email'
);

select is(
  (select booking_id from ceaute.booking_dispute where stripe_dispute_id = 'dp_open_1'),
  '39000000-0000-0000-0000-000000000001'::uuid,
  'the dispute is joined back to the booking through its PaymentIntent'
);

select is(
  (select recipient_role from ceaute.booking_email_outbox where event_type = 'dispute_opened_operator'),
  'operator',
  'the alert is addressed to the operator, not the customer or provider'
);

select is(
  (select payload ->> 'dispute_amount_pence' from ceaute.booking_email_outbox where event_type = 'dispute_opened_operator'),
  '1000',
  'the alert payload carries the disputed amount'
);

-- The private address must never reach an operator alert payload.
select is_empty(
  $$select 1 from ceaute.booking_email_outbox
    where recipient_role = 'operator'
      and (payload ? 'address_line_1' or payload ? 'access_instructions')$$,
  'the alert payload carries no private address'
);

-- Replaying the same event must change nothing.
select is(
  (select out_emails_enqueued from ceaute.record_stripe_dispute(
    'dp_open_1', 'ch_dispute_1', 'pi_dispute_1', 1000, 'gbp',
    'needs_response', 'fraudulent', now() + interval '7 days', 'created',
    'ops@example.test'
  )),
  0,
  'a replayed open event enqueues no second email'
);

select is(
  (select count(*)::integer from ceaute.booking_dispute where stripe_dispute_id = 'dp_open_1'),
  1,
  'a replayed event updates the same dispute row rather than adding one'
);

-- Funds withdrawn: a distinct material moment, so a distinct alert.
select is(
  (select out_emails_enqueued from ceaute.record_stripe_dispute(
    'dp_open_1', 'ch_dispute_1', 'pi_dispute_1', 1000, 'gbp',
    'under_review', 'fraudulent', null, 'funds_withdrawn', 'ops@example.test'
  )),
  1,
  'funds being withdrawn raises its own alert'
);

select isnt(
  (select funds_withdrawn_at from ceaute.booking_dispute where stripe_dispute_id = 'dp_open_1'),
  null,
  'the withdrawal is timestamped'
);

select is(
  (select evidence_due_at is not null from ceaute.booking_dispute where stripe_dispute_id = 'dp_open_1'),
  true,
  'a later event without a deadline does not erase the one already known'
);

-- An evidence edit is recorded but must not wake anybody.
select is(
  (select out_emails_enqueued from ceaute.record_stripe_dispute(
    'dp_open_1', 'ch_dispute_1', 'pi_dispute_1', 1000, 'gbp',
    'under_review', 'fraudulent', null, 'updated', 'ops@example.test'
  )),
  0,
  'charge.dispute.updated records silently'
);

-- An unmatched dispute is still recorded, because that is the case that most
-- needs a person.
select is(
  (select out_booking_id from ceaute.record_stripe_dispute(
    'dp_orphan', 'ch_orphan', 'pi_not_ours', 2500, 'gbp',
    'needs_response', null, null, 'created', 'ops@example.test'
  )),
  null,
  'a dispute with no matching payment has no booking'
);

select is(
  (select count(*)::integer from ceaute.booking_dispute where stripe_dispute_id = 'dp_orphan'),
  1,
  'an unmatched dispute is recorded anyway'
);

select throws_ok(
  $$select * from ceaute.record_stripe_dispute('dp_bad', null, 'pi_dispute_2', 100, 'gbp', 'needs_response', null, null, 'nonsense', 'ops@example.test')$$,
  'Unknown dispute event kind: nonsense',
  'an unrecognised event kind is refused rather than half-recorded'
);

-- The operator listing.
select ok(
  (select count(*) from ceaute.list_booking_disputes()) = 2,
  'open disputes are listed, including the unmatched one'
);

select is(
  (select count(*)::integer from ceaute.list_booking_disputes()
   where stripe_dispute_id = 'dp_open_1' and closed_at is not null),
  0,
  'a dispute is not treated as closed until a closed event arrives'
);

select * from finish();

rollback;
