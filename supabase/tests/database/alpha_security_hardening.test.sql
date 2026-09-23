begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(31);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'customer-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'customer-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'provider-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'provider-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = case id
  when '00000000-0000-0000-0000-000000000001' then 'Customer One'
  when '00000000-0000-0000-0000-000000000002' then 'Customer Two'
  when '00000000-0000-0000-0000-000000000003' then 'Provider One'
  else 'Provider Two'
end,
phone_e164 = '+447700900000';

insert into ceaute.provider_page (
  id,
  owner_profile_id,
  username,
  display_name,
  biography,
  provider_category,
  status
)
values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003', 'provider.one', 'Provider One', 'Ready provider', 'Nails', 'draft'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004', 'provider.two', 'Provider Two', 'Suspended provider', 'Nails', 'suspended');

insert into ceaute.provider_location (
  provider_page_id,
  public_area,
  address_line_1,
  city,
  postcode,
  access_instructions,
  is_active
)
values (
  '10000000-0000-0000-0000-000000000003',
  'Central London',
  '10 Private Street',
  'London',
  'W1A 1AA',
  'Use the private side entrance',
  true
);

insert into ceaute.availability_rule (
  provider_page_id,
  weekday,
  starts_at,
  ends_at
)
values (
  '10000000-0000-0000-0000-000000000003',
  1,
  '09:00',
  '17:00'
);

insert into ceaute.treatment (
  id,
  provider_page_id,
  name,
  description,
  duration_minutes,
  price_pence,
  discovery_category_id,
  is_active
)
values (
  '20000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003',
  'Secure manicure',
  'Test treatment',
  60,
  5000,
  (select id from ceaute.discovery_category order by display_order limit 1),
  true
);

insert into ceaute.provider_booking_setting (
  provider_page_id,
  payment_mode,
  deposit_percent,
  cancellation_window_hours,
  written_policy
)
values (
  '10000000-0000-0000-0000-000000000003',
  'full',
  20,
  24,
  'Test policy'
);

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('10000000-0000-0000-0000-000000000003', ceaute.current_provider_agreement_version(), '00000000-0000-0000-0000-000000000003');

insert into ceaute.portfolio_image (
  provider_page_id,
  storage_path,
  caption,
  is_visible
)
values (
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000003/security-test.webp',
  'Security test',
  true
);

insert into ceaute.provider_payment_account (
  provider_page_id,
  stripe_account_id,
  dashboard,
  identity_country,
  recipient_applied,
  stripe_transfers_status,
  payouts_status,
  requirements_currently_due,
  requirements_past_due,
  requirements_eventually_due,
  last_stripe_update_at
)
values (
  '10000000-0000-0000-0000-000000000003',
  'acct_security_provider_one',
  'express',
  'GB',
  true,
  'active',
  'active',
  array[]::text[],
  array[]::text[],
  array[]::text[],
  now()
);

insert into ceaute.booking (
  id,
  customer_profile_id,
  provider_page_id,
  treatment_id,
  start_at,
  end_at,
  status,
  expires_at,
  confirmed_at,
  customer_snapshot,
  service_snapshot
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    now() + interval '8 days',
    now() + interval '8 days 1 hour',
    'cancelled',
    now() - interval '1 minute',
    null,
    '{"full_name":"Customer One","email":"customer-one@example.test","phone":"+447700900000"}',
    '{"provider_display_name":"Provider One","treatment_name":"Secure manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Central London","address_line_1":"10 Private Street","city":"London","postcode":"W1A 1AA","access_instructions":"Use the private side entrance","cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    now() + interval '10 days',
    now() + interval '10 days 1 hour',
    'confirmed',
    now() - interval '1 day',
    now() - interval '1 day',
    '{"full_name":"Customer One","email":"customer-one@example.test","phone":"+447700900000"}',
    '{"provider_display_name":"Provider One","treatment_name":"Secure manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Central London","address_line_1":"10 Private Street","city":"London","postcode":"W1A 1AA","access_instructions":"Use the private side entrance","cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    now() + interval '11 days',
    now() + interval '11 days 1 hour',
    'confirmed',
    now() - interval '1 day',
    now() - interval '1 day',
    '{"full_name":"Customer Two","email":"customer-two@example.test","phone":"+447700900000"}',
    '{"provider_display_name":"Provider One","treatment_name":"Secure manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Central London","address_line_1":"10 Private Street","city":"London","postcode":"W1A 1AA","access_instructions":"Use the private side entrance","cancellation_window_hours":24,"commitment_amount_pence":1000}'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000003',
    now() + interval '12 days',
    now() + interval '12 days 1 hour',
    'awaiting_payment',
    now() + interval '5 minutes',
    null,
    '{"full_name":"Customer One","email":"customer-one@example.test","phone":"+447700900000"}',
    '{"provider_display_name":"Provider One","treatment_name":"Secure manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Central London","address_line_1":"10 Private Street","city":"London","postcode":"W1A 1AA","access_instructions":"Use the private side entrance","cancellation_window_hours":24,"commitment_amount_pence":1000}'
  );

insert into ceaute.booking_payment_attempt (
  id,
  booking_id,
  attempt_number,
  checkout_idempotency_key,
  stripe_checkout_session_id,
  stripe_payment_intent_id,
  amount_charged_pence,
  total_booking_value_pence,
  amount_due_later_pence,
  payment_status,
  provider_stripe_account_id
)
values
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000002', 1, 'ceaute-checkout-40000000-0000-0000-0000-000000000002', 'cs_security_2', 'pi_security_2', 5000, 5000, 0, 'succeeded', 'acct_security_provider_one'),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000003', 1, 'ceaute-checkout-40000000-0000-0000-0000-000000000003', 'cs_security_3', 'pi_security_3', 5000, 5000, 0, 'succeeded', 'acct_security_provider_one'),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000004', 1, 'ceaute-checkout-40000000-0000-0000-0000-000000000004', 'cs_security_4', 'pi_security_4', 5000, 5000, 0, 'checkout_created', 'acct_security_provider_one');

select hasnt_function(
  'ceaute',
  'confirm_test_booking_hold',
  array['uuid'],
  'The test-confirmation function is removed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_matching(
  $$update ceaute.booking set status = 'confirmed' where id = '30000000-0000-0000-0000-000000000004'$$,
  'permission denied',
  'Customers cannot confirm a booking by updating the table'
);
select throws_matching(
  $$select * from ceaute.complete_booking_payment_attempt('40000000-0000-0000-0000-000000000004', 'pi_forged', 'cs_forged', 'paid', 'gbp', 5000)$$,
  'permission denied',
  'Customers cannot invoke payment completion'
);
select throws_matching(
  $$select * from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', null)$$,
  'Invalid cancellation actor',
  'Null cancellation actors are rejected'
);
select throws_matching(
  $$select * from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', 'admin')$$,
  'Invalid cancellation actor',
  'Unknown cancellation actors are rejected'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select throws_matching(
  $$select * from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', 'customer')$$,
  'Booking not found',
  'Another customer cannot cancel a booking by UUID'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select throws_matching(
  $$select * from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', 'provider')$$,
  'Booking not found',
  'Another provider cannot cancel a booking by UUID'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select throws_matching(
  $$select service_snapshot from ceaute.booking$$,
  'permission denied',
  'Authenticated users cannot select address-bearing booking snapshots directly'
);
select is(
  (
    select service_snapshot ->> 'postcode'
    from ceaute.get_customer_booking_summaries('30000000-0000-0000-0000-000000000001')
  ),
  null,
  'An expired unpaid customer hold has no postcode in its detail summary'
);
select is(
  (
    select service_snapshot ->> 'access_instructions'
    from ceaute.get_booking_hold_summary('30000000-0000-0000-0000-000000000001')
  ),
  null,
  'The hold-summary RPC redacts never-confirmed cancellations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (
    select service_snapshot ->> 'address_line_1'
    from ceaute.get_provider_booking_summaries('30000000-0000-0000-0000-000000000001')
  ),
  null,
  'An expired unpaid provider summary has no exact address'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select is(
  (
    select service_snapshot ->> 'postcode'
    from ceaute.get_customer_booking_summaries()
    where id = '30000000-0000-0000-0000-000000000002'
  ),
  null,
  'Customer list summaries redact paid-booking addresses'
);
select is(
  (
    select service_snapshot ->> 'postcode'
    from ceaute.get_customer_booking_summaries('30000000-0000-0000-0000-000000000002')
  ),
  'W1A 1AA',
  'A paid confirmed customer detail includes the postcode'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (
    select service_snapshot ->> 'access_instructions'
    from ceaute.get_provider_booking_summaries('30000000-0000-0000-0000-000000000002')
  ),
  'Use the private side entrance',
  'A paid confirmed provider detail includes access instructions'
);
select throws_matching(
  $$update ceaute.provider_page set status = 'published' where id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'Providers cannot publish by direct update'
);
select throws_matching(
  $$update ceaute.provider_payment_account set payouts_status = 'active' where provider_page_id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'Providers cannot falsify Stripe readiness'
);
select throws_matching(
  $$update ceaute.provider_payment_account set stripe_account_id = 'acct_forged' where provider_page_id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'Providers cannot replace platform-controlled Stripe account IDs'
);
select throws_matching(
  $$update ceaute.provider_payment_account set requirements_currently_due = array[]::text[] where provider_page_id = '10000000-0000-0000-0000-000000000003'$$,
  'permission denied',
  'Providers cannot erase webhook-maintained Stripe requirements'
);
select lives_ok(
  $$update ceaute.provider_page set biography = 'Legitimate edited biography' where id = '10000000-0000-0000-0000-000000000003'$$,
  'Providers can edit profile content'
);
select lives_ok(
  $$select ceaute.publish_provider_page()$$,
  'A ready provider can publish through the trusted operation'
);

reset role;
select is(
  (select status from ceaute.provider_page where id = '10000000-0000-0000-0000-000000000003'),
  'published',
  'Trusted publication changes the page state'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok(
  $$select ceaute.unpublish_provider_page()$$,
  'The owning provider can unpublish through the trusted operation'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select throws_matching(
  $$update ceaute.provider_page set status = 'draft' where id = '10000000-0000-0000-0000-000000000004'$$,
  'permission denied',
  'A provider cannot directly undo suspension'
);
select throws_matching(
  $$select ceaute.publish_provider_page()$$,
  'Suspended pages cannot be published',
  'A suspended provider cannot republish through the trusted operation'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select ceaute.sync_provider_payment_account(
    '10000000-0000-0000-0000-000000000003',
    'acct_security_provider_one',
    'express',
    'GB',
    true,
    'active',
    'pending',
    array['individual.verification.document'],
    array[]::text[],
    array['individual.address.line1']
  )$$,
  'The trusted Stripe sync operation can update webhook-maintained state'
);

reset role;
select is(
  (select requirements_currently_due[1] from ceaute.provider_payment_account where provider_page_id = '10000000-0000-0000-0000-000000000003'),
  'individual.verification.document',
  'Trusted Stripe synchronization persists requirements'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is(
  (
    select outcome
    from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', 'customer')
  ),
  'cancelled',
  'The owning customer can cancel'
);
select is(
  (
    select outcome
    from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000002', 'customer')
  ),
  'already_cancelled',
  'Authorized repeated cancellation remains idempotent'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select is(
  (
    select outcome
    from ceaute.prepare_booking_cancellation('30000000-0000-0000-0000-000000000003', 'provider')
  ),
  'cancelled',
  'The owning provider can cancel'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select lives_ok(
  $$select * from ceaute.complete_booking_payment_attempt(
    '40000000-0000-0000-0000-000000000004',
    'pi_security_4',
    'cs_security_4',
    'paid',
    'gbp',
    5000
  )$$,
  'The trusted paid-webhook operation can confirm a live hold'
);

reset role;
select ok(
  exists (
    select 1
    from ceaute.booking
    where id = '30000000-0000-0000-0000-000000000004'
      and status = 'confirmed'
      and confirmed_at is not null
  ),
  'Paid confirmation records authoritative confirmation state'
);

select * from finish();
rollback;
