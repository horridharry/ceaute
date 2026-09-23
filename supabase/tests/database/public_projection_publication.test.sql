begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(25);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role;

-- Three provider pages carrying identical public data, differing only in
-- status, plus an unrelated signed-in account to call the projections from.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'published-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'draft-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'suspended-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '08000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'other-account@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Visibility Test', phone_e164 = '+447700900777'
where id::text like '08000000-%';

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('18000000-0000-0000-0000-000000000001', '08000000-0000-0000-0000-000000000001',
   'visible.one', 'Published Provider', 'Fixture', 'Nails', 'published'),
  ('18000000-0000-0000-0000-000000000002', '08000000-0000-0000-0000-000000000002',
   'visible.two', 'Draft Provider', 'Fixture', 'Nails', 'draft'),
  ('18000000-0000-0000-0000-000000000003', '08000000-0000-0000-0000-000000000003',
   'visible.three', 'Suspended Provider', 'Fixture', 'Nails', 'suspended');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, is_active
)
select
  provider_page.id, 'Central London', '9 Private Street', 'London', 'EC1A 1AA', true
from ceaute.provider_page
where provider_page.id::text like '18000000-%';

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent, cancellation_window_hours, written_policy
)
select provider_page.id, 'full', 20, 24, 'Fixture policy'
from ceaute.provider_page
where provider_page.id::text like '18000000-%';

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select provider_page.id, weekday, '09:00', '17:00'
from ceaute.provider_page, generate_series(0, 6) as weekday
where provider_page.id::text like '18000000-%';

insert into ceaute.blocked_date (provider_page_id, local_date)
select provider_page.id, (now() at time zone 'Europe/London')::date + 10
from ceaute.provider_page
where provider_page.id::text like '18000000-%';

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values
  ('28000000-0000-0000-0000-000000000001', '18000000-0000-0000-0000-000000000001', 'Manicure', 'Fixture', 60, 5000, true),
  ('28000000-0000-0000-0000-000000000002', '18000000-0000-0000-0000-000000000002', 'Manicure', 'Fixture', 60, 5000, true),
  ('28000000-0000-0000-0000-000000000003', '18000000-0000-0000-0000-000000000003', 'Manicure', 'Fixture', 60, 5000, true);

-- One confirmed future appointment per page, so occupied periods has something
-- to disclose if the visibility rule fails.
insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, confirmed_at, customer_snapshot, service_snapshot
)
select
  ('38000000-0000-0000-0000-00000000000' || right(provider_page.id::text, 1))::uuid,
  '08000000-0000-0000-0000-000000000004',
  provider_page.id,
  treatment.id,
  now() + interval '8 days',
  now() + interval '8 days 1 hour',
  'confirmed',
  now(),
  '{"full_name":"Other Account","email":"other-account@example.test","phone":"+447700900777"}'::jsonb,
  '{"provider_display_name":"Fixture","treatment_name":"Manicure","duration_minutes":60,"total_price_pence":5000,"public_area":"Central London","address_line_1":"9 Private Street","city":"London","postcode":"EC1A 1AA","cancellation_window_hours":24,"commitment_amount_pence":1000}'::jsonb
from ceaute.provider_page
join ceaute.treatment on treatment.provider_page_id = provider_page.id
where provider_page.id::text like '18000000-%';

-- The grants are what make this reachable without the web loader; they must
-- survive the redefinition, or the fix would be untested in practice.
select ok(
  bool_and(has_function_privilege('authenticated', p.oid, 'EXECUTE')),
  'Signed-in users can still call every public projection'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ceaute' and p.proname like 'get\_public\_%';
select ok(
  bool_and(has_function_privilege('service_role', p.oid, 'EXECUTE')),
  'The storefront loader can still call every public projection'
)
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ceaute' and p.proname like 'get\_public\_%';

-- Another signed-in account calling the RPCs directly, with the page IDs in
-- hand. This is the path the web loader does not stand in front of.
set local role authenticated;
select set_config('request.jwt.claim.sub', '08000000-0000-0000-0000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_availability_rules('18000000-0000-0000-0000-000000000001')) = 7,
  'Published working hours are available'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_availability_rules('18000000-0000-0000-0000-000000000002')) = 0,
  'Draft working hours are not disclosed'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_availability_rules('18000000-0000-0000-0000-000000000003')) = 0,
  'Suspended working hours are not disclosed'
);

insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_blocked_dates('18000000-0000-0000-0000-000000000001')) = 1,
  'Published blocked dates are available'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_blocked_dates('18000000-0000-0000-0000-000000000002')) = 0,
  'Draft blocked dates are not disclosed'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_blocked_dates('18000000-0000-0000-0000-000000000003')) = 0,
  'Suspended blocked dates are not disclosed'
);

insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_occupied_periods('18000000-0000-0000-0000-000000000001')) = 1,
  'Published occupied periods are available'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_occupied_periods('18000000-0000-0000-0000-000000000002')) = 0,
  'Draft occupied periods are not disclosed'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_occupied_periods('18000000-0000-0000-0000-000000000003')) = 0,
  'Suspended occupied periods are not disclosed'
);

insert into tap_results (result) select is(
  (select public_area from ceaute.get_public_provider_location('18000000-0000-0000-0000-000000000001')),
  'Central London'::varchar,
  'A published public area is available'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_provider_location('18000000-0000-0000-0000-000000000002')) = 0,
  'A draft public area is not disclosed'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_provider_location('18000000-0000-0000-0000-000000000003')) = 0,
  'A suspended public area is not disclosed'
);

insert into tap_results (result) select is(
  (select written_policy from ceaute.get_public_booking_settings('18000000-0000-0000-0000-000000000001')),
  'Fixture policy',
  'Published booking terms are available'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_booking_settings('18000000-0000-0000-0000-000000000002')) = 0,
  'Draft booking terms are not disclosed'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_booking_settings('18000000-0000-0000-0000-000000000003')) = 0,
  'Suspended booking terms are not disclosed'
);

-- The same page IDs from the service role, which is how the storefront renders
-- server-side. Being trusted does not reopen a draft page: the predicate lives
-- inside the security-definer body, not in the caller.
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_availability_rules('18000000-0000-0000-0000-000000000001')) = 7,
  'The storefront loader still reads a published provider''s working hours'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_availability_rules('18000000-0000-0000-0000-000000000002')) = 0,
  'The service role cannot read draft working hours through the projection'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_blocked_dates('18000000-0000-0000-0000-000000000002')) = 0,
  'The service role cannot read draft blocked dates through the projection'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_occupied_periods('18000000-0000-0000-0000-000000000002')) = 0,
  'The service role cannot read draft occupied periods through the projection'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_provider_location('18000000-0000-0000-0000-000000000002')) = 0,
  'The service role cannot read a draft public area through the projection'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.get_public_booking_settings('18000000-0000-0000-0000-000000000002')) = 0,
  'The service role cannot read draft booking terms through the projection'
);

-- The provider still reaches their own draft page through the tables the
-- dashboard and its storefront preview read, which RLS scopes to the owner.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '08000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select ok(
  (select count(*) from ceaute.provider_location
   where provider_page_id = '18000000-0000-0000-0000-000000000002') = 1,
  'A draft provider still reads their own location for preview'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.availability_rule
   where provider_page_id = '18000000-0000-0000-0000-000000000002') = 7,
  'A draft provider still reads their own working hours for preview'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
