begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(34);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role, anon;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09200000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'checks-draft@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09200000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'checks-live@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09200000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'checks-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09200000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'checks-stranger@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Checks Test', phone_e164 = '+447700900922'
where id::text like '09200000-%';

-- A draft with no bio and everything else except the agreement, and a live page
-- published before the agreement became a publication requirement.
insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('19200000-0000-0000-0000-000000000001', '09200000-0000-0000-0000-000000000001', 'checks.draft', 'Checks Draft', null, 'Nails', 'draft'),
  ('19200000-0000-0000-0000-000000000002', '09200000-0000-0000-0000-000000000002', 'checks.live', 'Checks Live', 'Has a bio', 'Nails', 'published');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, is_active
)
select id, 'Camden, London', '2 Private Road', 'London', 'NW1 1AA', true
from ceaute.provider_page where id::text like '19200000-%';

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select provider_page.id, weekday, '09:00', '17:00'
from ceaute.provider_page, generate_series(0, 6) as weekday
where provider_page.id::text like '19200000-%';

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
select
  ('29200000' || substr(provider_page.id::text, 9))::uuid, provider_page.id,
  'Checks treatment', null, 60, 4000,
  (select id from ceaute.discovery_category order by display_order limit 1), true
from ceaute.provider_page where id::text like '19200000-%';

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent, cancellation_window_hours
)
select id, 'deposit', 25, 48
from ceaute.provider_page where id::text like '19200000-%';

insert into ceaute.portfolio_image (provider_page_id, storage_path, is_visible)
select id, id::text || '/work.webp', true
from ceaute.provider_page where id::text like '19200000-%';

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
select id, 'acct_checks_' || right(id::text, 1), true, 'active', 'active'
from ceaute.provider_page where id::text like '19200000-%';

create temp table checks_times as
select
  ((((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London') as first_start,
  ((((now() at time zone 'Europe/London')::date + 4)::timestamp + time '12:00') at time zone 'Europe/London') as second_start;
grant select on table checks_times to authenticated, service_role;

-- A hold on the live page taken before the rule existed, still in progress.
insert into ceaute.booking (
  id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, customer_snapshot, service_snapshot
)
values (
  '39200000-0000-0000-0000-000000000001', '09200000-0000-0000-0000-000000000003',
  '19200000-0000-0000-0000-000000000002', '29200000-0000-0000-0000-000000000002',
  now() + interval '6 days', now() + interval '6 days 1 hour',
  'awaiting_payment', now() + interval '10 minutes', '{"email":"checks-customer@example.test"}',
  '{"payment_mode":"deposit","deposit_percent":25,"amount_due_now_pence":1000,"commitment_amount_pence":1000,"total_price_pence":4000,"cancellation_window_hours":48}'
);

insert into tap_results select is(
  ceaute.current_provider_agreement_version(), '2026-09-18',
  'PostgreSQL knows the current provider agreement version');

-- Who can read the breakdown -------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '09200000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select is(
  (select row(has_business_profile, has_bookable_treatment, has_visible_photo, has_current_location,
              has_working_hours, has_booking_terms, payments_ready, agreement_accepted)::text
   from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')),
  '(t,t,t,t,t,t,t,f)', 'The owner sees every requirement met except the agreement, with no bio');
insert into tap_results select is(
  (select meets_publication_requirements
   from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')),
  false, 'Without the agreement the draft is not ready to publish');
insert into tap_results select throws_matching(
  $$select ceaute.publish_provider_page()$$,
  'Publication requirements are incomplete',
  'Publishing is refused without the current agreement');
insert into tap_results select throws_matching(
  $$select * from ceaute.provider_page_publication_check_values('19200000-0000-0000-0000-000000000001')$$,
  'permission denied', 'The internal breakdown is not callable by signed-in users');

select set_config('request.jwt.claim.sub', '09200000-0000-0000-0000-000000000004', true);
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')),
  0, 'Another signed-in user learns nothing about the page');

reset role;
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
insert into tap_results select throws_matching(
  $$select * from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')$$,
  'permission denied', 'Signed-out visitors cannot call the breakdown');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')),
  1, 'The trusted backend can read the breakdown');
reset role;

-- Accepting the agreement makes the draft publishable ---------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '09200000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select lives_ok(
  $$insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
    values ('19200000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '09200000-0000-0000-0000-000000000001')$$,
  'The owner accepts the current agreement');
insert into tap_results select is(
  (select row(agreement_accepted, meets_publication_requirements)::text
   from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000001')),
  '(t,t)', 'Every requirement is now met');
insert into tap_results select lives_ok(
  $$select ceaute.publish_provider_page()$$,
  'A draft without a bio publishes once the agreement is accepted');

reset role;
insert into tap_results select is(
  (select status from ceaute.provider_page where id = '19200000-0000-0000-0000-000000000001'),
  'published', 'Bio is optional for publication');
insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19200000-0000-0000-0000-000000000001'),
  true, 'A page that met every requirement takes bookings');

-- The transition: a live page without the current agreement ---------------------------
insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19200000-0000-0000-0000-000000000002'),
  false, 'A live page without the current agreement takes no new bookings');
insert into tap_results select is(
  (select status from ceaute.provider_page where id = '19200000-0000-0000-0000-000000000002'),
  'published', 'It stays published; nothing unpublishes it');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '09200000-0000-0000-0000-000000000003', '19200000-0000-0000-0000-000000000002',
    '29200000-0000-0000-0000-000000000002', (select first_start from checks_times)
  ),
  'Provider is not taking bookings', 'No new hold without the current agreement');
insert into tap_results select is(
  (select action from ceaute.claim_booking_checkout(
    '39200000-0000-0000-0000-000000000001', 1000, 4000, 3000, 55, 'gbp', 'acct_checks_2',
    'https://example.test/s', 'https://example.test/c')),
  'provider_unavailable', 'A hold taken before the rule cannot open Checkout either');
insert into tap_results select is(
  (select count(*)::integer from ceaute.booking_payment_attempt where booking_id = '39200000-0000-0000-0000-000000000001'),
  0, 'No payment attempt is recorded for it');
insert into tap_results select is(
  (select accepts_new_bookings from ceaute.get_public_booking_terms('19200000-0000-0000-0000-000000000002', 4000)),
  false, 'The public quote tells the storefront the page is not taking bookings');

reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '09200000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into tap_results select is(
  (select row(meets_publication_requirements, accepts_new_bookings, agreement_accepted)::text
   from ceaute.get_provider_page_publication_checks('19200000-0000-0000-0000-000000000002')),
  '(f,f,f)', 'The owner can see why: the agreement');
insert into tap_results select lives_ok(
  $$insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
    values ('19200000-0000-0000-0000-000000000002', ceaute.current_provider_agreement_version(), '09200000-0000-0000-0000-000000000002')$$,
  'The live provider accepts the current agreement');
reset role;

insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19200000-0000-0000-0000-000000000002'),
  true, 'Accepting resumes bookings at once');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '09200000-0000-0000-0000-000000000003', '19200000-0000-0000-0000-000000000002',
    '29200000-0000-0000-0000-000000000002', (select first_start from checks_times)
  ),
  'A hold is accepted once the agreement is accepted');
insert into tap_results select is(
  (select action from ceaute.claim_booking_checkout(
    '39200000-0000-0000-0000-000000000001', 1000, 4000, 3000, 55, 'gbp', 'acct_checks_2',
    'https://example.test/s', 'https://example.test/c')),
  'create', 'The earlier hold can now open Checkout');
reset role;

-- Other reasons a live page takes no new bookings --------------------------------------
insert into ceaute.provider_liability (provider_page_id, reason, amount_owed_pence, stripe_dispute_id)
values ('19200000-0000-0000-0000-000000000002', 'dispute_lost_provider_responsible', 2500, 'dp_checks');

insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19200000-0000-0000-0000-000000000002'),
  false, 'An outstanding balance pauses new bookings');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '09200000-0000-0000-0000-000000000003', '19200000-0000-0000-0000-000000000002',
    '29200000-0000-0000-0000-000000000002', (select second_start from checks_times)
  ),
  'Provider is not taking bookings', 'No new hold while a balance is outstanding');
reset role;

update ceaute.provider_liability set status = 'recovered', amount_recovered_pence = 2500
where provider_page_id = '19200000-0000-0000-0000-000000000002';
update ceaute.provider_payment_account set payouts_status = 'pending'
where provider_page_id = '19200000-0000-0000-0000-000000000002';

insert into tap_results select is(
  ceaute.provider_page_accepts_new_bookings('19200000-0000-0000-0000-000000000002'),
  false, 'A Stripe account that stops being ready pauses new bookings');
insert into tap_results select is(
  (select status from ceaute.provider_page where id = '19200000-0000-0000-0000-000000000002'),
  'published', 'The page is still never unpublished');

-- Usernames: full stops between characters only -------------------------------------
set local role authenticated;
select set_config('request.jwt.claim.sub', '09200000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select throws_matching(
  $$update ceaute.provider_page set username = '.checks' where id = '19200000-0000-0000-0000-000000000001'$$,
  'provider_page_username_format', 'A leading full stop is refused');
insert into tap_results select throws_matching(
  $$update ceaute.provider_page set username = 'checks.' where id = '19200000-0000-0000-0000-000000000001'$$,
  'provider_page_username_format', 'A trailing full stop is refused');
insert into tap_results select throws_matching(
  $$update ceaute.provider_page set username = 'checks..draft' where id = '19200000-0000-0000-0000-000000000001'$$,
  'provider_page_username_format', 'Two full stops together are refused');
insert into tap_results select throws_matching(
  $$update ceaute.provider_page set username = 'Checks.Draft' where id = '19200000-0000-0000-0000-000000000001'$$,
  'provider_page_username_format', 'Capital letters are refused (usernames are stored lower case)');
insert into tap_results select lives_ok(
  $$update ceaute.provider_page set username = 'checks.draft.studio' where id = '19200000-0000-0000-0000-000000000001'$$,
  'Full stops between characters are accepted');
insert into tap_results select throws_matching(
  $$update ceaute.provider_page set username = 'checks.live' where id = '19200000-0000-0000-0000-000000000001'$$,
  'provider_page_username_unique', 'Usernames stay unique');

reset role;
insert into tap_results select * from finish();
select result from tap_results;
rollback;
