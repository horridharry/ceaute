begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(69);

create temp table tap_results (result text);
grant insert, select on table tap_results to anon, authenticated, service_role;

-- Availability released in drops (docs/decisions/007-availability-released-in-drops.md).
--
-- Pages:
--   1f..01 published, fully bookable: constraints, RLS, saving, open dates, holds;
--   1f..02 draft and 1f..03 suspended: one opened drop each, never public;
--   1f..04 published: the availability summary and its drop names;
--   1f..05 published: two upcoming drops with the same drop time;
--   1f..06 draft: the availability publication requirement.

create function pg_temp.london_day(offset_days integer)
returns date
language sql
stable
as $$ select (now() at time zone 'Europe/London')::date + offset_days $$;

create function pg_temp.london_at(offset_days integer, local_time time)
returns timestamptz
language sql
stable
as $$ select (pg_temp.london_day(offset_days) + local_time) at time zone 'Europe/London' $$;

-- One date row written straight to the table, for the constraint and grant checks.
create function pg_temp.date_insert(
  local_date date,
  hours_start text,
  hours_end text,
  start_times text
)
returns text
language sql
stable
as $$
  select format(
    'insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end, start_times) values (%L, %L, %L, %L::time, %L::time, %L::time[])',
    '1f000000-0000-0000-0000-000000000001',
    '4f000000-0000-0000-0000-000000000001',
    local_date, hours_start, hours_end, start_times
  )
$$;

-- A save_availability_drop call on the bookable page, with every date 09:00-17:00.
create function pg_temp.save_call(
  target_drop_id uuid,
  opens_on date,
  opens_time time,
  day_offsets integer[]
)
returns text
language sql
stable
as $$
  select format(
    'select ceaute.save_availability_drop(%L, %L, %L, %L, %L::jsonb)',
    '1f000000-0000-0000-0000-000000000001',
    target_drop_id, opens_on, opens_time,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
          'local_date', pg_temp.london_day(offset_day),
          'hours_start', '09:00',
          'hours_end', '17:00'
        ) order by offset_day)
       from unnest(day_offsets) as offset_day),
      '[]'::jsonb
    )
  )
$$;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'drops-owner@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'drops-draft@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'drops-suspended@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'drops-summary@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'drops-tie@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'drops-checks@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0f000000-0000-0000-0000-000000000009', 'authenticated', 'authenticated', 'drops-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Drops Test', phone_e164 = '+447700900144'
where id::text like '0f000000-%';

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('1f000000-0000-0000-0000-000000000001', '0f000000-0000-0000-0000-000000000001', 'drops.owner', 'Drops Owner', 'Drops fixture', 'Nails', 'published'),
  ('1f000000-0000-0000-0000-000000000002', '0f000000-0000-0000-0000-000000000002', 'drops.draft', 'Drops Draft', 'Drops fixture', 'Nails', 'draft'),
  ('1f000000-0000-0000-0000-000000000003', '0f000000-0000-0000-0000-000000000003', 'drops.suspended', 'Drops Suspended', 'Drops fixture', 'Nails', 'suspended'),
  ('1f000000-0000-0000-0000-000000000004', '0f000000-0000-0000-0000-000000000004', 'drops.summary', 'Drops Summary', 'Drops fixture', 'Nails', 'published'),
  ('1f000000-0000-0000-0000-000000000005', '0f000000-0000-0000-0000-000000000005', 'drops.tie', 'Drops Tie', 'Drops fixture', 'Nails', 'published'),
  ('1f000000-0000-0000-0000-000000000006', '0f000000-0000-0000-0000-000000000006', 'drops.checks', 'Drops Checks', 'Drops fixture', 'Nails', 'draft');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, is_active
)
values (
  '1f000000-0000-0000-0000-000000000001', 'Central London', '4 Private Street',
  'London', 'SW1A 1AA', true
);

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent, cancellation_window_hours
)
values ('1f000000-0000-0000-0000-000000000001', 'full', 20, 24);

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
values ('1f000000-0000-0000-0000-000000000001', 'acct_drops', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('1f000000-0000-0000-0000-000000000001', ceaute.current_provider_agreement_version(), '0f000000-0000-0000-0000-000000000001');

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values
  ('2f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000001', 'Hour treatment', 'Fixture', 60, 5000, true),
  ('2f000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000001', 'Long treatment', 'Fixture', 150, 9000, true);

-- Summary dates, relative to the first day M of a month at least two months
-- ahead, so every one is in the future.
create temp table summary_dates as
select
  m,
  m + 2 as a_first,
  m + 3 as a_last,
  m + 15 as c_first,
  m + 20 as c_last,
  (m + interval '1 month')::date as d_month,
  (m + interval '1 month')::date + 4 as d_first,
  (m + interval '1 month')::date + 10 as d_last,
  (m + interval '2 months')::date as e_month,
  (m + interval '2 months')::date + 1 as e_first,
  (m + interval '2 months')::date + 5 as e_last,
  now() + interval '1 day' as c_opens_at,
  now() + interval '2 days' as d_opens_at
from (select date_trunc('month', pg_temp.london_day(62))::date as m) as base;

grant select on table summary_dates to anon, authenticated, service_role;

insert into ceaute.availability_drop (id, provider_page_id, opens_at)
select fixture.id::uuid, fixture.page_id::uuid, fixture.opens_at
from summary_dates
cross join lateral (
  values
    -- Bookable page: O every date, S one start-times date, L one date whose
    -- drop time moves later, U a drop that has not opened.
    ('4f000000-0000-0000-0000-000000000001', '1f000000-0000-0000-0000-000000000001', now() - interval '1 day'),
    ('4f000000-0000-0000-0000-000000000002', '1f000000-0000-0000-0000-000000000001', now() - interval '1 day'),
    ('4f000000-0000-0000-0000-000000000003', '1f000000-0000-0000-0000-000000000001', now() - interval '1 day'),
    ('4f000000-0000-0000-0000-000000000004', '1f000000-0000-0000-0000-000000000001', now() + interval '1 day'),
    ('4f000000-0000-0000-0000-000000000011', '1f000000-0000-0000-0000-000000000002', now() - interval '1 day'),
    ('4f000000-0000-0000-0000-000000000021', '1f000000-0000-0000-0000-000000000003', now() - interval '1 day'),
    -- Summary page: A and E opened, C and D upcoming.
    ('4f000000-0000-0000-0000-000000000031', '1f000000-0000-0000-0000-000000000004', now() - interval '1 day'),
    ('4f000000-0000-0000-0000-000000000032', '1f000000-0000-0000-0000-000000000004', c_opens_at),
    ('4f000000-0000-0000-0000-000000000033', '1f000000-0000-0000-0000-000000000004', d_opens_at),
    ('4f000000-0000-0000-0000-000000000034', '1f000000-0000-0000-0000-000000000004', now() - interval '1 day'),
    -- Tie-break page: the same drop time; the lower id has the later first date.
    ('4f000000-0000-0000-0000-000000000041', '1f000000-0000-0000-0000-000000000005', now() + interval '3 days'),
    ('4f000000-0000-0000-0000-000000000042', '1f000000-0000-0000-0000-000000000005', now() + interval '3 days')
) as fixture(id, page_id, opens_at);

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
select '1f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000001', pg_temp.london_day(offset_day), '09:00', '17:00'
from generate_series(-1, 120) as offset_day;

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, start_times)
values ('1f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000002', pg_temp.london_day(130), '{10:00,12:00,15:00}');

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
values
  ('1f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000003', pg_temp.london_day(135), '09:00', '17:00'),
  ('1f000000-0000-0000-0000-000000000001', '4f000000-0000-0000-0000-000000000004', pg_temp.london_day(140), '09:00', '17:00');

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
select page_drop.page_id::uuid, page_drop.drop_id::uuid, pg_temp.london_day(offset_day), '09:00', '17:00'
from (
  values
    ('1f000000-0000-0000-0000-000000000002', '4f000000-0000-0000-0000-000000000011'),
    ('1f000000-0000-0000-0000-000000000003', '4f000000-0000-0000-0000-000000000021')
) as page_drop(page_id, drop_id)
cross join generate_series(0, 5) as offset_day;

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
select fixture.page_id::uuid, fixture.drop_id::uuid, fixture.local_date, '09:00', '17:00'
from summary_dates
cross join lateral (
  values
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000031', a_first),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000031', a_last),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000032', c_first),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000032', c_last),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000033', d_first),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000033', d_last),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000034', e_first),
    ('1f000000-0000-0000-0000-000000000004', '4f000000-0000-0000-0000-000000000034', e_last),
    ('1f000000-0000-0000-0000-000000000005', '4f000000-0000-0000-0000-000000000041', m + 8),
    ('1f000000-0000-0000-0000-000000000005', '4f000000-0000-0000-0000-000000000042', m + 5)
) as fixture(page_id, drop_id, local_date);

-- (a) Constraints ----------------------------------------------------------------

insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), '09:00', '17:00', '{10:00}'),
  '23514', null, 'A date cannot have both hours and start times');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), null, null, null),
  '23514', null, 'A date must have hours or start times');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), '12:00', '12:00', null),
  '23514', null, 'Closing time must be after opening time');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), '09:10', '17:00', null),
  '23514', null, 'An opening time off the quarter hour is rejected');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), null, null, '{10:00,10:00}'),
  '23514', null, 'Start times cannot repeat');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), null, null, '{12:00,10:00}'),
  '23514', null, 'Start times must be in order');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), null, null, '{10:05}'),
  '23514', null, 'A start time off the quarter hour is rejected');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(1), '09:00', '17:00', null),
  '23505', null, 'A page has at most one row per date');

-- (a) RLS and grants ---------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select is(
  (select count(*)::integer from ceaute.availability_drop
   where provider_page_id = '1f000000-0000-0000-0000-000000000001'),
  4, 'The owner reads their own drops');
insert into tap_results select is(
  (select count(*)::integer from ceaute.availability_date
   where provider_page_id = '1f000000-0000-0000-0000-000000000001'),
  125, 'The owner reads their own dates, opened or not');

insert into tap_results select throws_ok(
  $$insert into ceaute.availability_drop (provider_page_id, opens_at)
    values ('1f000000-0000-0000-0000-000000000001', now())$$,
  '42501', null, 'The owner cannot insert a drop directly');
insert into tap_results select throws_ok(
  $$update ceaute.availability_drop set opens_at = now()
    where provider_page_id = '1f000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'The owner cannot update a drop directly');
insert into tap_results select throws_ok(
  $$delete from ceaute.availability_drop
    where provider_page_id = '1f000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'The owner cannot delete a drop directly');
insert into tap_results select throws_ok(
  pg_temp.date_insert(pg_temp.london_day(200), '09:00', '17:00', null),
  '42501', null, 'The owner cannot insert a date directly');
insert into tap_results select throws_ok(
  $$update ceaute.availability_date set hours_end = '16:00'
    where provider_page_id = '1f000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'The owner cannot update a date directly');
insert into tap_results select throws_ok(
  $$delete from ceaute.availability_date
    where provider_page_id = '1f000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'The owner cannot delete a date directly');

select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000002', true);

insert into tap_results select is(
  (select count(*)::integer from ceaute.availability_drop
   where provider_page_id = '1f000000-0000-0000-0000-000000000001'),
  0, 'Another provider reads none of the owner''s drops');
insert into tap_results select is(
  (select count(*)::integer from ceaute.availability_date
   where provider_page_id = '1f000000-0000-0000-0000-000000000001'),
  0, 'Another provider reads none of the owner''s dates');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

-- anon holds no table grant at all, so a read is refused outright rather than
-- returning zero rows.
insert into tap_results select throws_ok(
  $$select count(*) from ceaute.availability_drop$$,
  '42501', null, 'Signed-out visitors cannot read drops');
insert into tap_results select throws_ok(
  $$select count(*) from ceaute.availability_date$$,
  '42501', null, 'Signed-out visitors cannot read dates');

-- (b) save_availability_drop -------------------------------------------------------

insert into tap_results select throws_ok(
  pg_temp.save_call(null, null, null, array[150]),
  '42501', null, 'Signed-out visitors cannot save a drop');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select throws_matching(
  pg_temp.save_call(null, null, null, array[150]),
  'Provider page not found\.', 'Another provider cannot save a drop on the page');

select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000001', true);

create temp table now_drop as
select ceaute.save_availability_drop(
  '1f000000-0000-0000-0000-000000000001', null, null, null,
  jsonb_build_array(jsonb_build_object('local_date', pg_temp.london_day(150), 'hours_start', '09:00', 'hours_end', '17:00'))
) as id;

insert into tap_results select ok(
  (select opens_at <= now() from ceaute.availability_drop where id = (select id from now_drop)),
  'A drop saved as Now is open at once');

create temp table later_drop as
select ceaute.save_availability_drop(
  '1f000000-0000-0000-0000-000000000001', null, pg_temp.london_day(2), '19:15',
  jsonb_build_array(jsonb_build_object('local_date', pg_temp.london_day(151), 'hours_start', '09:00', 'hours_end', '17:00'))
) as id;

insert into tap_results select is(
  (select opens_at from ceaute.availability_drop where id = (select id from later_drop)),
  (pg_temp.london_day(2) + time '19:15') at time zone 'Europe/London',
  'A Later drop time is stored as that London local time');

insert into tap_results select throws_matching(
  pg_temp.save_call(null, pg_temp.london_day(-1), '10:00', array[155]),
  'Drop time has passed\.', 'A Later drop time already passed is refused');
insert into tap_results select throws_matching(
  pg_temp.save_call(null, pg_temp.london_day(2), '19:10', array[155]),
  'Drop time must be on the quarter hour\.', 'A Later drop time off the quarter hour is refused');
insert into tap_results select throws_matching(
  pg_temp.save_call(null, pg_temp.london_day(2), null, array[155]),
  'Drop time is incomplete\.', 'A drop date without a drop time is refused');
insert into tap_results select throws_matching(
  pg_temp.save_call(null, null, '19:00', array[155]),
  'Drop time is incomplete\.', 'A drop time without a drop date is refused');
insert into tap_results select throws_matching(
  pg_temp.save_call(null, null, null, array[-1]),
  'Choose dates from today on\.', 'A past date is refused');
insert into tap_results select throws_matching(
  pg_temp.save_call(null, null, null, array[1]),
  'Date is in another drop\.', 'A date already in another drop is refused');

create temp table resave_drop as
select ceaute.save_availability_drop(
  '1f000000-0000-0000-0000-000000000001', null, null, null,
  jsonb_build_array(
    jsonb_build_object('local_date', pg_temp.london_day(152), 'hours_start', '09:00', 'hours_end', '17:00'),
    jsonb_build_object('local_date', pg_temp.london_day(153), 'hours_start', '09:00', 'hours_end', '17:00'),
    jsonb_build_object('local_date', pg_temp.london_day(154), 'hours_start', '09:00', 'hours_end', '17:00')
  )
) as id;

create temp table resaved as
select ceaute.save_availability_drop(
  '1f000000-0000-0000-0000-000000000001', (select id from resave_drop), null, null,
  jsonb_build_array(
    jsonb_build_object('local_date', pg_temp.london_day(152), 'hours_start', '10:00', 'hours_end', '16:00'),
    jsonb_build_object('local_date', pg_temp.london_day(153), 'start_times', jsonb_build_array('10:00', '12:00'))
  )
) as id;

insert into tap_results select is(
  (select id from resaved), (select id from resave_drop),
  'Re-saving a drop returns the same drop');
insert into tap_results select is(
  (select array_agg(local_date order by local_date) from ceaute.availability_date
   where drop_id = (select id from resave_drop)),
  array[pg_temp.london_day(152), pg_temp.london_day(153)],
  'Dates left out of a re-save are removed');
insert into tap_results select is(
  (select format('%s-%s', hours_start, hours_end) from ceaute.availability_date
   where drop_id = (select id from resave_drop) and local_date = pg_temp.london_day(152)),
  '10:00:00-16:00:00',
  'Hours of a kept date are updated');
insert into tap_results select is(
  (select start_times from ceaute.availability_date
   where drop_id = (select id from resave_drop) and local_date = pg_temp.london_day(153)),
  '{10:00,12:00}'::time[],
  'A kept date can change from hours to start times');

create temp table emptied as
select ceaute.save_availability_drop(
  '1f000000-0000-0000-0000-000000000001', (select id from resave_drop), null, null, '[]'::jsonb
) as id;

insert into tap_results select ok(
  (select id from emptied) is null,
  'Saving a drop with no dates returns null');
insert into tap_results select ok(
  not exists (select 1 from ceaute.availability_drop where id = (select id from resave_drop)),
  'Saving a drop with no dates deletes it');

-- (c) get_public_open_dates --------------------------------------------------------

-- Signed-out visitors have no usage on the ceaute schema: the storefront and
-- booking pages read the public projections on the server with the service
-- role and no signed-in user, so that is the visitor's path tested here.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

insert into tap_results select throws_ok(
  $$select * from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000001')$$,
  '42501', null, 'Signed-out visitors cannot call the open dates directly');

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000001')
   where local_date between pg_temp.london_day(0) and pg_temp.london_day(120)),
  121, 'Every date of an opened drop on a published page is public');
insert into tap_results select is(
  (select start_times from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000001')
   where local_date = pg_temp.london_day(130)),
  '{10:00,12:00,15:00}'::time[], 'An open date returns its start times');
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000001')
   where local_date in (pg_temp.london_day(140), pg_temp.london_day(151))),
  0, 'Dates of a drop whose drop time is still to come are left out');
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000001')
   where local_date < pg_temp.london_day(0)),
  0, 'Dates before London today are left out');
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000002')),
  0, 'A draft page has no public dates, even through the service role');
insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_open_dates('1f000000-0000-0000-0000-000000000003')),
  0, 'A suspended page has no public dates, even through the service role');

-- (d) get_public_availability_summary ----------------------------------------------

-- Still the service role with no signed-in user: the visitor's path.

insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004')),
  3, 'The summary has the two open drops and only the next upcoming one');
insert into tap_results select ok(
  exists (
    select 1
    from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
    where summary.drop_month is null
      and summary.first_date = summary_dates.a_first
      and summary.last_date = summary_dates.a_last
      and summary.opens_at is null
      and summary.is_open
  ),
  'An open drop sharing its month is named by its first and last dates');
insert into tap_results select ok(
  exists (
    select 1
    from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
    where summary.drop_month = summary_dates.e_month
      and summary.first_date is null
      and summary.last_date is null
      and summary.opens_at is null
      and summary.is_open
  ),
  'An open drop alone in its month is named by the month only');
insert into tap_results select ok(
  exists (
    select 1
    from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
    where summary.drop_month is null
      and summary.first_date = summary_dates.c_first
      and summary.last_date = summary_dates.c_last
      and summary.opens_at = summary_dates.c_opens_at
      and not summary.is_open
  ),
  'The next upcoming drop, named by a range, returns only that range and its drop time');
insert into tap_results select ok(
  not exists (
    select 1
    from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
    where summary.drop_month in (summary_dates.d_first, summary_dates.d_last)
      or summary.first_date in (summary_dates.d_first, summary_dates.d_last)
      or summary.last_date in (summary_dates.d_first, summary_dates.d_last)
      or summary.opens_at = summary_dates.d_opens_at
  ),
  'A later upcoming drop leaves no trace in the summary');

reset role;
delete from ceaute.availability_drop where id = '4f000000-0000-0000-0000-000000000032';

set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select ok(
  (select count(*) = 1
      and bool_and(
        summary.drop_month = summary_dates.d_month
        and summary.first_date is null
        and summary.last_date is null
        and summary.opens_at = summary_dates.d_opens_at
      )
   from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
   where not summary.is_open),
  'The next upcoming drop, named by its month, returns the month and its drop time');
insert into tap_results select ok(
  not exists (
    select 1
    from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000004') as summary, summary_dates
    where summary.drop_month in (summary_dates.d_first, summary_dates.d_last)
      or summary.first_date in (summary_dates.d_first, summary_dates.d_last)
      or summary.last_date in (summary_dates.d_first, summary_dates.d_last)
  ),
  'An upcoming drop named by its month returns none of its dates');

insert into tap_results select ok(
  (select count(*) = 1
      and bool_and(not summary.is_open and summary.first_date = summary_dates.m + 5)
   from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000005') as summary, summary_dates),
  'Of two drops with the same drop time, only the one with the earlier first date is shown');

insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000002')),
  0, 'The service role gets no summary for a draft page');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

insert into tap_results select throws_ok(
  $$select * from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Signed-out visitors cannot call the summary directly');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000002')),
  1, 'The owner of a draft page sees its summary for preview');

select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000001', true);

insert into tap_results select is(
  (select count(*)::integer from ceaute.get_public_availability_summary('1f000000-0000-0000-0000-000000000002')),
  0, 'Another provider gets no summary for a draft page they do not own');

-- (e) create_validated_booking_hold ------------------------------------------------

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(3, '12:00')
  ), 'A start inside the hours of an opened date is accepted');
insert into tap_results select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(90, '12:00')
  ), 'A start 90 days ahead is accepted: there is no booking window');

create temp table start_times_hold as
select ceaute.create_validated_booking_hold(
  '0f000000-0000-0000-0000-000000000009',
  '1f000000-0000-0000-0000-000000000001',
  '2f000000-0000-0000-0000-000000000002',
  array[]::uuid[],
  pg_temp.london_at(130, '10:00')
) as id;

insert into tap_results select ok(
  (select id from start_times_hold) is not null,
  'A 150-minute treatment can start at a listed start time');

insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(140, '12:00')
  ), 'Requested time is unavailable', 'A date whose drop has not opened is refused');
insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(125, '12:00')
  ), 'Requested time is unavailable', 'A date in no drop is refused');
insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(3, '18:00')
  ), 'Requested time is unavailable', 'A start outside the date''s hours is refused');
insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(130, '10:15')
  ), 'Requested time is unavailable', 'A start that is not one of the date''s start times is refused');
insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(130, '12:00')
  ), 'conflicting key value violates exclusion constraint',
  'A start time inside an earlier booking is refused by the overlap constraint');

insert into tap_results select lives_ok(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(135, '10:00')
  ), 'An opened date takes holds before its drop time moves');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '0f000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results select lives_ok(
  pg_temp.save_call('4f000000-0000-0000-0000-000000000003', pg_temp.london_day(1), '19:00', array[135]),
  'The owner moves an opened drop''s drop time later');

reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '0f000000-0000-0000-0000-000000000009', '1f000000-0000-0000-0000-000000000001',
    '2f000000-0000-0000-0000-000000000001', pg_temp.london_at(135, '13:00')
  ), 'Requested time is unavailable', 'Moving the drop time later hides the date again');

-- (f) Publication requirement ------------------------------------------------------

reset role;

insert into tap_results select is(
  (select has_working_hours from ceaute.provider_page_publication_check_values('1f000000-0000-0000-0000-000000000006')),
  false, 'With no dates the availability requirement is not met');

insert into ceaute.availability_drop (id, provider_page_id, opens_at)
values ('4f000000-0000-0000-0000-000000000051', '1f000000-0000-0000-0000-000000000006', now() + interval '5 days');
insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
values ('1f000000-0000-0000-0000-000000000006', '4f000000-0000-0000-0000-000000000051', pg_temp.london_day(10), '09:00', '17:00');

insert into tap_results select is(
  (select has_working_hours from ceaute.provider_page_publication_check_values('1f000000-0000-0000-0000-000000000006')),
  true, 'One future date meets the availability requirement before its drop opens');

delete from ceaute.availability_date where provider_page_id = '1f000000-0000-0000-0000-000000000006';
insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
values ('1f000000-0000-0000-0000-000000000006', '4f000000-0000-0000-0000-000000000051', pg_temp.london_day(-3), '09:00', '17:00');

insert into tap_results select is(
  (select has_working_hours from ceaute.provider_page_publication_check_values('1f000000-0000-0000-0000-000000000006')),
  false, 'Only past dates do not meet the availability requirement');

insert into tap_results select * from finish();
select result from tap_results;
rollback;
