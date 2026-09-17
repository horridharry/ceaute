begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(9);

-- One customer, one provider, one treatment, and eight confirmed bookings
-- whose payment attempts each carry their own PaymentIntent, so each refund
-- operation stands alone for the entitlement trigger.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'recovery-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'recovery-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, status)
values ('18000000-0000-0000-0000-000000000001', '08000000-0000-0000-0000-000000000002', 'refund.recovery', 'Refund Recovery Provider', 'draft');

insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence, is_active)
values ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'Recovery manicure', 'Fixture', 60, 5000, true);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at, status, confirmed_at
)
select
  ('38000000-0000-0000-0000-00000000000' || n)::uuid,
  '08000000-0000-0000-0000-000000000001',
  '18000000-0000-0000-0000-000000000001',
  '28000000-0000-0000-0000-000000000001',
  now() + make_interval(days => n),
  now() + make_interval(days => n, hours => 1),
  'confirmed',
  now() - interval '1 day'
from generate_series(1, 8) as n;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
select
  ('58000000-0000-0000-0000-00000000000' || n)::uuid,
  ('38000000-0000-0000-0000-00000000000' || n)::uuid,
  1,
  'ceaute-checkout-recovery-' || n,
  'cs_recovery_' || n,
  'pi_recovery_' || n,
  5000, 5000, 0, 0, 'refund_required', 'acct_recovery'
from generate_series(1, 8) as n;

-- Refund operations in every state the recovery pass must distinguish.
insert into ceaute.booking_refund_operation (
  id, booking_id, booking_payment_attempt_id, purpose, expected_amount_pence,
  idempotency_key, stripe_payment_intent_id, status, stripe_refund_id,
  processing_started_at, last_attempt_at, create_attempted_at, created_at
)
values
  -- 1. requested twelve minutes ago and never driven: recovered.
  ('68000000-0000-0000-0000-000000000001', '38000000-0000-0000-0000-000000000001', '58000000-0000-0000-0000-000000000001', 'cancellation', 5000,
   'ceaute-refund-recovery-1', 'pi_recovery_1', 'requested', null, null, null, null, now() - interval '12 minutes'),
  -- 2. requested just now: the synchronous driver still owns it.
  ('68000000-0000-0000-0000-000000000002', '38000000-0000-0000-0000-000000000002', '58000000-0000-0000-0000-000000000002', 'cancellation', 5000,
   'ceaute-refund-recovery-2', 'pi_recovery_2', 'requested', null, null, null, null, now()),
  -- 3. pending with no Stripe refund id (unproven creation): recovered.
  ('68000000-0000-0000-0000-000000000003', '38000000-0000-0000-0000-000000000003', '58000000-0000-0000-0000-000000000003', 'cancellation', 5000,
   'ceaute-refund-recovery-3', 'pi_recovery_3', 'pending', null, null, now() - interval '11 minutes', now() - interval '11 minutes', now() - interval '11 minutes'),
  -- 4. pending with a Stripe refund id attempted ten minutes ago: left to the webhook.
  ('68000000-0000-0000-0000-000000000004', '38000000-0000-0000-0000-000000000004', '58000000-0000-0000-0000-000000000004', 'cancellation', 5000,
   'ceaute-refund-recovery-4', 'pi_recovery_4', 'pending', 're_recovery_4', null, now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '10 minutes'),
  -- 5. processing lease abandoned ten minutes ago: recovered.
  ('68000000-0000-0000-0000-000000000005', '38000000-0000-0000-0000-000000000005', '58000000-0000-0000-0000-000000000005', 'cancellation', 5000,
   'ceaute-refund-recovery-5', 'pi_recovery_5', 'processing', null, now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '10 minutes', now() - interval '10 minutes'),
  -- 6. succeeded: terminal.
  ('68000000-0000-0000-0000-000000000006', '38000000-0000-0000-0000-000000000006', '58000000-0000-0000-0000-000000000006', 'cancellation', 5000,
   'ceaute-refund-recovery-6', 'pi_recovery_6', 'succeeded', 're_recovery_6', null, now() - interval '1 day', now() - interval '1 day', now() - interval '1 day'),
  -- 7. requires_review: terminal until a person acts.
  ('68000000-0000-0000-0000-000000000007', '38000000-0000-0000-0000-000000000007', '58000000-0000-0000-0000-000000000007', 'cancellation', 5000,
   'ceaute-refund-recovery-7', 'pi_recovery_7', 'requires_review', null, null, now() - interval '2 days', now() - interval '2 days', now() - interval '2 days'),
  -- 8. pending with a Stripe refund id and no news for two hours: reconciled.
  ('68000000-0000-0000-0000-000000000008', '38000000-0000-0000-0000-000000000008', '58000000-0000-0000-0000-000000000008', 'cancellation', 5000,
   'ceaute-refund-recovery-8', 'pi_recovery_8', 'pending', 're_recovery_8', null, now() - interval '2 hours', now() - interval '2 hours', now() - interval '2 hours');

select is(
  (
    select count(*)
    from cron.job
    where jobname = 'ceaute-recover-booking-refunds'
      and schedule = '*/10 * * * *'
      and command = $job$select ceaute.invoke_cron_endpoint('/api/cron/recover-booking-refunds')$job$
      and active
  ),
  1::bigint,
  'Refund recovery is scheduled every 10 minutes against the recovery endpoint'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '08000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_matching(
  $$select * from ceaute.list_retryable_booking_refund_operations(10)$$,
  'permission denied',
  'Signed-in users cannot list refund operations'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

select is(
  (
    select array_agg(refund_operation_id order by refund_operation_id)
    from ceaute.list_retryable_booking_refund_operations(10)
  ),
  array[
    '68000000-0000-0000-0000-000000000001',
    '68000000-0000-0000-0000-000000000003',
    '68000000-0000-0000-0000-000000000005',
    '68000000-0000-0000-0000-000000000008'
  ]::uuid[],
  'Only undriven, unproven, abandoned, and long-silent operations are listed'
);

select is(
  (
    select refund_status
    from ceaute.list_retryable_booking_refund_operations(10)
    where refund_operation_id = '68000000-0000-0000-0000-000000000001'
  ),
  'requested',
  'The listing reports each operation''s current status'
);

select is(
  (select refund_operation_id from ceaute.list_retryable_booking_refund_operations(1)),
  '68000000-0000-0000-0000-000000000008'::uuid,
  'The oldest operation is listed first and the limit is honoured'
);

select is(
  (select count(*) from ceaute.list_retryable_booking_refund_operations(0)),
  1::bigint,
  'A limit below one still lists one operation'
);

-- Claiming an operation leases it, so the next pass leaves it alone.
select is(
  (
    select action
    from ceaute.claim_booking_refund_operation('68000000-0000-0000-0000-000000000001')
  ),
  'create',
  'A recovered requested operation claims as a fresh Stripe refund creation'
);

select ok(
  not exists (
    select 1
    from ceaute.list_retryable_booking_refund_operations(10)
    where refund_operation_id = '68000000-0000-0000-0000-000000000001'
  ),
  'A freshly leased operation is not listed again'
);

select ok(
  not exists (
    select 1
    from ceaute.list_retryable_booking_refund_operations(10)
    where refund_operation_id in (
      '68000000-0000-0000-0000-000000000002',
      '68000000-0000-0000-0000-000000000004',
      '68000000-0000-0000-0000-000000000006',
      '68000000-0000-0000-0000-000000000007'
    )
  ),
  'Fresh, webhook-owned, and terminal operations are never listed'
);

reset role;

select * from finish();

rollback;
