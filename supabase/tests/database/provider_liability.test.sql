begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(22);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'liability-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'liability-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, status)
values ('1a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'liable.studio', 'Liable Studio', 'published');

insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence, is_active)
values ('2a000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000001', 'Disputed set', 'Fixture', 60, 5000, true);

insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, confirmed_at, service_snapshot
)
values (
  '3a000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000001',
  '1a000000-0000-0000-0000-000000000001', '2a000000-0000-0000-0000-000000000001',
  now() + interval '2 days', now() + interval '2 days 1 hour', 'confirmed', now() - interval '1 day',
  jsonb_build_object('treatment_name', 'Disputed set', 'total_price_pence', 5000)
);

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  ceaute_fee_pence, payment_status, provider_stripe_account_id
)
values (
  '5a000000-0000-0000-0000-000000000001', '3a000000-0000-0000-0000-000000000001', 1,
  'ceaute-checkout-liability-1', 'cs_liability_1', 'pi_liability_1',
  1000, 5000, 4000, 55, 'succeeded', 'acct_liability'
);

insert into ceaute.booking_dispute (
  stripe_dispute_id, booking_id, booking_payment_attempt_id,
  stripe_payment_intent_id, amount_pence, status, responsibility
)
values (
  'dp_liability_1', '3a000000-0000-0000-0000-000000000001',
  '5a000000-0000-0000-0000-000000000001', 'pi_liability_1', 1000, 'lost', 'undetermined'
);

-- The ledger is operator-only.
set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$select 1 from ceaute.provider_liability$$,
  '42501',
  'permission denied for table provider_liability',
  'a provider cannot read the liability ledger'
);

select throws_ok(
  $$select * from ceaute.record_provider_liability('dp_liability_1', 1000)$$,
  '42501',
  'permission denied for function record_provider_liability',
  'a provider cannot record their own liability'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

-- Responsibility has to be decided before any debt exists.
select throws_ok(
  $$select * from ceaute.record_provider_liability('dp_liability_1', 1000)$$,
  'Only a provider-responsible dispute creates provider liability.',
  'an undetermined dispute creates no provider debt'
);

update ceaute.booking_dispute
set responsibility = 'provider'
where stripe_dispute_id = 'dp_liability_1';

select is(
  (select out_amount_owed_pence from ceaute.record_provider_liability('dp_liability_1', 1000)),
  1000::bigint,
  'a lost provider-responsible dispute owes the reversed amount'
);

select is(
  (select outstanding_pence from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
  1000::bigint,
  'the whole amount starts outstanding'
);

select is(
  (select provider_page_id from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
  '1a000000-0000-0000-0000-000000000001'::uuid,
  'the debt is attached to the provider page behind the booking'
);

-- Idempotent: recording the same dispute again must not double the debt.
select is(
  (select out_amount_owed_pence from ceaute.record_provider_liability('dp_liability_1', 1000)),
  1000::bigint,
  'recording the same dispute twice does not double the debt'
);

select is(
  (select count(*)::integer from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
  1,
  'only one liability row exists for one dispute'
);

-- Partial recovery: Stripe could only reach £4.00 of the £10.00.
select is(
  (select out_outstanding_pence from ceaute.record_provider_liability_recovery(
    (select id from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
    400, 'trr_first'
  )),
  600::bigint,
  'a partial recovery leaves the remainder outstanding'
);

select is(
  (select status from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
  'outstanding',
  'a partly recovered liability is still outstanding'
);

-- Replaying the same reversal must not count the money twice.
select is(
  (select out_amount_recovered_pence from ceaute.record_provider_liability_recovery(
    (select id from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
    400, 'trr_first'
  )),
  400::bigint,
  'replaying the same reversal recovers nothing further'
);

-- A provider with debt is restricted.
select is(
  (select out_outstanding_pence from ceaute.get_provider_financial_standing(
    '1a000000-0000-0000-0000-000000000001', '2026-09-18'
  )),
  600::bigint,
  'financial standing reports the outstanding total'
);

select is(
  (select out_accepted_agreement_version from ceaute.get_provider_financial_standing(
    '1a000000-0000-0000-0000-000000000001', '2026-09-18'
  )),
  null,
  'an unaccepted agreement reports as no version'
);

-- Settling the rest resolves it.
select is(
  (select out_status from ceaute.record_provider_liability_recovery(
    (select id from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
    600, 'trr_second'
  )),
  'recovered',
  'recovering the remainder resolves the liability'
);

select isnt(
  (select resolved_at from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
  null,
  'resolution is timestamped'
);

select is(
  (select out_outstanding_pence from ceaute.get_provider_financial_standing(
    '1a000000-0000-0000-0000-000000000001', '2026-09-18'
  )),
  0::bigint,
  'a settled provider has nothing outstanding'
);

-- Recovery can never exceed what is owed.
select is(
  (select out_amount_recovered_pence from ceaute.record_provider_liability_recovery(
    (select id from ceaute.provider_liability where stripe_dispute_id = 'dp_liability_1'),
    99999, 'trr_overshoot'
  )),
  1000::bigint,
  'recovery is capped at the amount owed'
);

-- A Ceaute-caused dispute creates nothing, whatever is passed in.
insert into ceaute.booking_dispute (
  stripe_dispute_id, booking_id, booking_payment_attempt_id,
  stripe_payment_intent_id, amount_pence, status, responsibility
)
values (
  'dp_liability_2', '3a000000-0000-0000-0000-000000000001',
  '5a000000-0000-0000-0000-000000000001', 'pi_liability_1', 1000, 'lost', 'ceaute'
);

select throws_ok(
  $$select * from ceaute.record_provider_liability('dp_liability_2', 1000)$$,
  'Only a provider-responsible dispute creates provider liability.',
  'a Ceaute-caused dispute creates no provider debt'
);

-- --- agreement acceptance ---------------------------------------------------

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values (
  '1a000000-0000-0000-0000-000000000001', '2026-09-18', '0a000000-0000-0000-0000-000000000002'
);

select is(
  (select out_accepted_agreement_version from ceaute.get_provider_financial_standing(
    '1a000000-0000-0000-0000-000000000001', '2026-09-18'
  )),
  '2026-09-18',
  'acceptance of the required version is reported'
);

select is(
  (select out_accepted_agreement_version from ceaute.get_provider_financial_standing(
    '1a000000-0000-0000-0000-000000000001', '2027-01-01'
  )),
  null,
  'acceptance of an older version does not satisfy a newer one'
);

select throws_ok(
  $$insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
    values ('1a000000-0000-0000-0000-000000000001', '2026-09-18', '0a000000-0000-0000-0000-000000000002')$$,
  '23505',
  NULL,
  'accepting the same version twice is refused rather than duplicated'
);

-- The record is immutable: no update or delete policy exists for providers.
set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok(
  $$update ceaute.provider_agreement_acceptance set accepted_at = now() - interval '1 year'$$,
  '42501',
  'permission denied for table provider_agreement_acceptance',
  'a provider cannot backdate their own acceptance'
);

select * from finish();

rollback;
