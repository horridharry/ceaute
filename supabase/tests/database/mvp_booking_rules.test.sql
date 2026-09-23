begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(17);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '05000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'rules-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '05000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'rules-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Rules Test', phone_e164 = '+447700900555'
where id in (
  '05000000-0000-0000-0000-000000000001',
  '05000000-0000-0000-0000-000000000002'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values (
  '15000000-0000-0000-0000-000000000001',
  '05000000-0000-0000-0000-000000000002',
  'rules.provider', 'Rules Provider', 'Rules fixture', 'Nails', 'published'
);

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, is_active
)
values (
  '15000000-0000-0000-0000-000000000001', 'Central London', '5 Private Street',
  'London', 'SW1A 1AA', true
);

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent, cancellation_window_hours
)
values ('15000000-0000-0000-0000-000000000001', 'full', 20, 24);

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
values ('15000000-0000-0000-0000-000000000001', 'acct_rules', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('15000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '05000000-0000-0000-0000-000000000002');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '15000000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values (
  '25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
  'Thirty-five minute treatment', 'Fixture', 35, 3500, true
);

create temp table rule_times as
select
  (((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London' as grid_start,
  (((now() at time zone 'Europe/London')::date + 60)::timestamp + time '12:00') at time zone 'Europe/London' as last_window_start,
  (((now() at time zone 'Europe/London')::date + 61)::timestamp + time '12:00') at time zone 'Europe/London' as outside_window_start;

grant select on table rule_times to authenticated, service_role;

-- Booking window and appointment start grid, at hold creation.
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table grid_hold as
select ceaute.create_validated_booking_hold(
  '05000000-0000-0000-0000-000000000001',
  '15000000-0000-0000-0000-000000000001',
  '25000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select grid_start from rule_times)
) as id;

insert into tap_results (result) select ok(
  (select id from grid_hold) is not null,
  'A 35-minute treatment can be held at a quarter-hour start'
);
insert into tap_results (result) select is(
  (select to_char(end_at at time zone 'Europe/London', 'HH24:MI')
   from ceaute.booking where id = (select id from grid_hold)),
  '12:35',
  'Treatment duration does not have to align to the 15-minute grid'
);
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '05000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
    '25000000-0000-0000-0000-000000000001', (select grid_start + interval '70 minutes' from rule_times)
  ), 'outside the booking rules', 'Appointment starts off the 15-minute grid are rejected');

insert into tap_results (result) select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '05000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
    '25000000-0000-0000-0000-000000000001', (select last_window_start from rule_times)
  ), 'A start on the 60th London calendar day is inside the booking window');
insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '05000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000001',
    '25000000-0000-0000-0000-000000000001', (select outside_window_start from rule_times)
  ), 'outside the booking rules', 'A start on the 61st London calendar day is rejected');

insert into tap_results (result) select throws_matching(
  $$select * from ceaute.claim_booking_checkout(
    (select id from grid_hold), 0, 3500, 3500, 0, 'gbp', 'acct_rules'
  )$$,
  'Invalid authoritative Checkout terms',
  'Checkout still rejects a zero online amount'
);

reset role;

insert into tap_results (result) select ok(
  not has_column_privilege('authenticated', 'ceaute.provider_page', 'booking_window_days', 'UPDATE'),
  'Providers cannot write the unused booking_window_days value'
);
insert into tap_results (result) select ok(
  has_column_privilege('authenticated', 'ceaute.provider_page', 'display_name', 'UPDATE'),
  'Providers can still update their page identity'
);

-- Payment policy, through the same upsert the booking settings form uses.
set local role authenticated;
select set_config('request.jwt.claim.sub', '05000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  $$insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, commitment_amount_pence, deposit_percent, cancellation_window_hours)
    values ('15000000-0000-0000-0000-000000000001', 'fixed_deposit', 500, null, 24)
    on conflict (provider_page_id) do update
    set payment_mode = excluded.payment_mode, commitment_amount_pence = excluded.commitment_amount_pence,
        deposit_percent = excluded.deposit_percent$$,
  'provider_booking_setting_percentage_terms',
  'A fixed-pound deposit can no longer be saved'
);
insert into tap_results (result) select throws_matching(
  $$insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, commitment_amount_pence, deposit_percent, cancellation_window_hours)
    values ('15000000-0000-0000-0000-000000000001', 'full', null, null, 24)
    on conflict (provider_page_id) do update
    set payment_mode = excluded.payment_mode, commitment_amount_pence = excluded.commitment_amount_pence,
        deposit_percent = excluded.deposit_percent$$,
  'provider_booking_setting_percentage_terms',
  'A blank percentage is rejected'
);
insert into tap_results (result) select lives_ok(
  $$insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, commitment_amount_pence, deposit_percent, cancellation_window_hours)
    values ('15000000-0000-0000-0000-000000000001', 'deposit', null, 30, 24)
    on conflict (provider_page_id) do update
    set payment_mode = excluded.payment_mode, commitment_amount_pence = excluded.commitment_amount_pence,
        deposit_percent = excluded.deposit_percent$$,
  'A 30% deposit is accepted'
);
insert into tap_results (result) select lives_ok(
  $$insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, commitment_amount_pence, deposit_percent, cancellation_window_hours)
    values ('15000000-0000-0000-0000-000000000001', 'full', null, 100, 24)
    on conflict (provider_page_id) do update
    set payment_mode = excluded.payment_mode, commitment_amount_pence = excluded.commitment_amount_pence,
        deposit_percent = excluded.deposit_percent$$,
  'Full payment keeping 100% after a late cancellation is accepted'
);

-- Working-period boundaries, through the provider RPC and a direct table write.
insert into tap_results (result) select lives_ok(
  $$select ceaute.replace_provider_availability_rules(
    '15000000-0000-0000-0000-000000000001',
    '[{"weekday": 0, "starts_at": "09:00", "ends_at": "17:00"}]'::jsonb
  )$$,
  '09:00-17:00 is a valid working period'
);
insert into tap_results (result) select lives_ok(
  $$select ceaute.replace_provider_availability_rules(
    '15000000-0000-0000-0000-000000000001',
    '[{"weekday": 0, "starts_at": "09:15", "ends_at": "17:45"}]'::jsonb
  )$$,
  '09:15-17:45 is a valid working period'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.replace_provider_availability_rules(
    '15000000-0000-0000-0000-000000000001',
    '[{"weekday": 0, "starts_at": "09:07", "ends_at": "17:00"}]'::jsonb
  )$$,
  'availability_rule_quarter_hour_boundaries',
  'An off-grid opening time is rejected'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.replace_provider_availability_rules(
    '15000000-0000-0000-0000-000000000001',
    '[{"weekday": 0, "starts_at": "09:00", "ends_at": "17:07"}]'::jsonb
  )$$,
  'availability_rule_quarter_hour_boundaries',
  'An off-grid closing time is rejected'
);
insert into tap_results (result) select throws_matching(
  $$insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
    values ('15000000-0000-0000-0000-000000000001', 1, '09:00:30', '17:00')$$,
  'availability_rule_quarter_hour_boundaries',
  'A direct table write cannot bypass the grid with seconds'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
