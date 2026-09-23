begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(16);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated, service_role, anon;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', ('09400000-0000-0000-0000-00000000000' || n)::uuid,
  'authenticated', 'authenticated', 'discover-' || n || '@example.test', '', now(),
  '{"provider":"email","providers":["email"]}', '{}', now(), now()
from generate_series(1, 8) as n;

-- Three listable providers, then five that must never appear.
insert into ceaute.provider_page (id, owner_profile_id, username, display_name, provider_category, status)
values
  ('19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000001', 'disc.alpha', 'Alpha Nails', 'Nails', 'published'),
  ('19400000-0000-0000-0000-000000000002', '09400000-0000-0000-0000-000000000002', 'disc.bravo', 'Bravo Brows', 'Brows', 'published'),
  ('19400000-0000-0000-0000-000000000003', '09400000-0000-0000-0000-000000000003', 'disc.charlie', 'Charlie Lashes', 'Lashes', 'published'),
  ('19400000-0000-0000-0000-000000000004', '09400000-0000-0000-0000-000000000004', 'disc.draft', 'Delta Draft', 'Nails', 'draft'),
  ('19400000-0000-0000-0000-000000000005', '09400000-0000-0000-0000-000000000005', 'disc.suspended', 'Echo Suspended', 'Nails', 'suspended'),
  ('19400000-0000-0000-0000-000000000006', '09400000-0000-0000-0000-000000000006', 'disc.notreat', 'Foxtrot No Treatments', 'Nails', 'published'),
  ('19400000-0000-0000-0000-000000000007', '09400000-0000-0000-0000-000000000007', 'disc.noloc', 'Golf No Location', 'Nails', 'published');

update ceaute.provider_page
set display_photo_path = '19400000-0000-0000-0000-000000000001/19400000-0000-0000-0000-00000000a001.webp'
where id = '19400000-0000-0000-0000-000000000001';

insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, is_active)
select id,
  case when id::text like '%2' then 'Shoreditch, London' else 'Peckham, London' end,
  '9 Hidden Street', 'London', 'SE15 9ZZ', true
from ceaute.provider_page
where id::text like '19400000-%' and id <> '19400000-0000-0000-0000-000000000007';

insert into ceaute.treatment (provider_page_id, name, duration_minutes, price_pence, discovery_category_id, is_active)
select id, 'Discover treatment', 60, 3000,
  (select id from ceaute.discovery_category where slug is not null order by display_order limit 1), true
from ceaute.provider_page
where id::text like '19400000-%' and id <> '19400000-0000-0000-0000-000000000006';

-- Alpha: four visible photos and one hidden; Bravo: one; Charlie: none.
insert into ceaute.portfolio_image (provider_page_id, storage_path, is_visible, display_order, created_at)
values
  ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001/d.webp', true, 3, now()),
  ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001/a.webp', true, 0, now()),
  ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001/hidden.webp', false, 1, now()),
  ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001/b.webp', true, 1, now() + interval '1 second'),
  ('19400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001/c.webp', true, 2, now()),
  ('19400000-0000-0000-0000-000000000002', '19400000-0000-0000-0000-000000000002/only.webp', true, 0, now());

-- Alpha: two visible reviews (5 and 4) and one hidden (1). Reviews hang off
-- completed bookings.
insert into ceaute.booking (id, customer_profile_id, provider_page_id, treatment_id, start_at, end_at, status, confirmed_at)
select
  ('39400000-0000-0000-0000-00000000000' || n)::uuid, '09400000-0000-0000-0000-000000000008',
  '19400000-0000-0000-0000-000000000001',
  (select id from ceaute.treatment where provider_page_id = '19400000-0000-0000-0000-000000000001' limit 1),
  now() - make_interval(days => n + 1), now() - make_interval(days => n + 1) + interval '1 hour',
  'completed', now() - make_interval(days => n + 2)
from generate_series(1, 3) as n;

insert into ceaute.booking_review (booking_id, provider_page_id, customer_profile_id, rating, is_visible)
values
  ('39400000-0000-0000-0000-000000000001', '19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000008', 5, true),
  ('39400000-0000-0000-0000-000000000002', '19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000008', 4, true),
  ('39400000-0000-0000-0000-000000000003', '19400000-0000-0000-0000-000000000001', '09400000-0000-0000-0000-000000000008', 1, false);

-- Only the trusted server calls it -------------------------------------------------
set local role anon;
select set_config('request.jwt.claim.role', 'anon', true);
insert into tap_results select throws_matching(
  $$select * from ceaute.discover_public_providers()$$, 'permission denied',
  'Signed-out visitors cannot call the Discover function directly');
reset role;

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into tap_results select throws_matching(
  $$select * from ceaute.discover_public_providers()$$, 'permission denied',
  'Signed-in users cannot call it directly either');
reset role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table browse as
select * from ceaute.discover_public_providers(null, null, 24, 0)
where username like 'disc.%';

reset role;

insert into tap_results select is(
  (select array_agg(username::text order by display_name) from browse),
  array['disc.alpha', 'disc.bravo', 'disc.charlie'],
  'Browsing lists published, located providers with an active treatment, alphabetically');
insert into tap_results select is(
  (select portfolio_storage_paths from browse where username = 'disc.alpha'),
  array[
    '19400000-0000-0000-0000-000000000001/a.webp',
    '19400000-0000-0000-0000-000000000001/b.webp',
    '19400000-0000-0000-0000-000000000001/c.webp'
  ],
  'The bento gets the first three visible photos in portfolio order');
insert into tap_results select is(
  (select portfolio_storage_paths from browse where username = 'disc.bravo'),
  array['19400000-0000-0000-0000-000000000002/only.webp'],
  'A provider with one photo gets one');
insert into tap_results select is(
  (select cardinality(portfolio_storage_paths) from browse where username = 'disc.charlie'),
  0, 'A provider with no visible photo gets none, never a placeholder path');
insert into tap_results select is(
  (select row(review_count, rating_total)::text from browse where username = 'disc.alpha'),
  '(2,9)', 'Only visible reviews count towards the rating');
insert into tap_results select is(
  (select row(review_count, rating_total)::text from browse where username = 'disc.bravo'),
  '(0,0)', 'No reviews means no rating, not an invented one');
insert into tap_results select is(
  (select display_photo_path from browse where username = 'disc.alpha'),
  '19400000-0000-0000-0000-000000000001/19400000-0000-0000-0000-00000000a001.webp',
  'The optional display photo is returned when set');
insert into tap_results select is(
  (select display_photo_path from browse where username = 'disc.bravo'),
  null, 'No display photo means null');
insert into tap_results select ok(
  pg_get_function_result('ceaute.discover_public_providers(text,text,integer,integer)'::regprocedure)
    !~* '(address|postcode|city|access|email|phone|owner)',
  'The function returns public fields only');

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table paged as
select 'first' as page, * from ceaute.discover_public_providers('peckham', null, 1, 0)
union all
select 'second' as page, * from ceaute.discover_public_providers('peckham', null, 1, 1);

create temp table clamped as
select count(*) as rows from ceaute.discover_public_providers(null, null, 1000, 0);

create temp table shoreditch as
select * from ceaute.discover_public_providers('SHOREDITCH', null, 24, 0);

reset role;

insert into tap_results select is(
  (select array_agg(username::text order by page) from paged),
  array['disc.alpha', 'disc.charlie'],
  'Paging walks the area search one page at a time');
insert into tap_results select is(
  (select distinct total_count from paged), 2::bigint,
  'Every page carries the total number of matches');
insert into tap_results select ok(
  (select rows <= 96 from clamped), 'A page is never larger than 96');
insert into tap_results select is(
  (select array_agg(username::text) from shoreditch where username like 'disc.%'),
  array['disc.bravo'], 'The area search is case-insensitive');
insert into tap_results select is(
  (select count(*)::integer from ceaute.search_public_providers(null, null) where username like 'disc.%'),
  3, 'The previous search keeps working for the previous deployment');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
