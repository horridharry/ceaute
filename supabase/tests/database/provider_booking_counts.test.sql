begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(18);

create temp table tap_results (result text);
grant insert, select on table tap_results to anon, authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '02100000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'counts-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '02100000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'counts-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '02100000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'counts-other-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Booking Counts Test', phone_e164 = '+447700900222'
where id in (
  '02100000-0000-0000-0000-000000000001',
  '02100000-0000-0000-0000-000000000002',
  '02100000-0000-0000-0000-000000000003'
);

-- Page A holds directly inserted count fixtures. Page B is bookable through
-- the trusted hold operation and is used for the blocked-date lock-in.
insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('12100000-0000-0000-0000-000000000001', '02100000-0000-0000-0000-000000000002',
   'counts.provider', 'Counts Provider', 'Counts fixture', 'Nails', 'published'),
  ('12100000-0000-0000-0000-000000000002', '02100000-0000-0000-0000-000000000003',
   'counts.lockin', 'Lock-in Provider', 'Lock-in fixture', 'Nails', 'published');

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
values (
  '12100000-0000-0000-0000-000000000002', 'Central London', '12 Private Street',
  'London', 'SW1A 1AA', 'Use the private entrance', true
);

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, deposit_percent,
  cancellation_window_hours, written_policy
)
values (
  '12100000-0000-0000-0000-000000000002', 'full', 20, 24, 'Fixture policy'
);

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, recipient_applied, stripe_transfers_status, payouts_status
)
values ('12100000-0000-0000-0000-000000000002', 'acct_counts', true, 'active', 'active');

insert into ceaute.provider_agreement_acceptance (
  provider_page_id, agreement_version, accepted_by_profile_id
)
values ('12100000-0000-0000-0000-000000000002', ceaute.current_provider_agreement_version(), '02100000-0000-0000-0000-000000000003');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '12100000-0000-0000-0000-000000000002', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values
  ('22100000-0000-0000-0000-000000000001', '12100000-0000-0000-0000-000000000001', 'Counts treatment', 'Fixture', 60, 5000, true),
  ('22100000-0000-0000-0000-000000000002', '12100000-0000-0000-0000-000000000002', 'Lock-in treatment', 'Fixture', 60, 5000, true);

create temp table count_dates as
select
  (now() at time zone 'Europe/London')::date as london_today,
  (now() at time zone 'Europe/London')::date + 5 as busy_date,
  (now() at time zone 'Europe/London')::date + 6 as quiet_date,
  -- 15 July next year is always in British Summer Time and in the future.
  make_date(extract(year from now())::integer + 1, 7, 15) as bst_utc_date,
  (now() at time zone 'Europe/London')::date + 3 as lockin_date;

grant select on table count_dates to anon, authenticated, service_role;

create function pg_temp.london_at(local_date date, local_time time)
returns timestamptz
language sql
immutable
as $$ select (local_date + local_time) at time zone 'Europe/London' $$;

insert into ceaute.booking (
  customer_profile_id, provider_page_id, treatment_id, start_at, end_at,
  status, expires_at, confirmed_at
)
select
  '02100000-0000-0000-0000-000000000001',
  '12100000-0000-0000-0000-000000000001',
  '22100000-0000-0000-0000-000000000001',
  fixture.start_at, fixture.start_at + interval '1 hour',
  fixture.status, fixture.expires_at, fixture.confirmed_at
from count_dates
cross join lateral (
  values
    -- Busy date: two confirmed, one unexpired hold, and three that must not count.
    (pg_temp.london_at(busy_date, '10:00'), 'confirmed', null::timestamptz, now()),
    (pg_temp.london_at(busy_date, '11:00'), 'confirmed', null::timestamptz, now()),
    (pg_temp.london_at(busy_date, '12:00'), 'awaiting_payment', now() + interval '5 minutes', null::timestamptz),
    (pg_temp.london_at(busy_date, '13:00'), 'awaiting_payment', now() - interval '1 minute', null::timestamptz),
    (pg_temp.london_at(busy_date, '10:00'), 'cancelled', null::timestamptz, now()),
    (pg_temp.london_at(busy_date, '14:00'), 'completed', null::timestamptz, now()),
    -- Quiet date: only an expired hold, a cancelled and a completed booking.
    (pg_temp.london_at(quiet_date, '10:00'), 'awaiting_payment', now() - interval '1 minute', null::timestamptz),
    (pg_temp.london_at(quiet_date, '11:00'), 'cancelled', null::timestamptz, now()),
    (pg_temp.london_at(quiet_date, '12:00'), 'completed', null::timestamptz, now()),
    -- 23:30 UTC during British Summer Time is 00:30 on the next London date.
    ((bst_utc_date + time '23:30') at time zone 'UTC', 'confirmed', null::timestamptz, now()),
    -- A confirmed booking before London today is excluded.
    (pg_temp.london_at(london_today - 1, '12:00'), 'confirmed', null::timestamptz, now())
) as fixture(start_at, status, expires_at, confirmed_at);

-- Shape and privileges.
insert into tap_results (result) select is(
  pg_get_function_result('ceaute.get_provider_booking_counts_by_local_date(uuid)'::regprocedure),
  'TABLE(local_date date, confirmed_count integer, in_progress_count integer)',
  'The function returns only local_date, confirmed_count and in_progress_count'
);
insert into tap_results (result) select ok(
  (select prosecdef and provolatile = 's'
   from pg_proc where oid = 'ceaute.get_provider_booking_counts_by_local_date(uuid)'::regprocedure),
  'The function is a stable security definer'
);
insert into tap_results (result) select ok(
  not has_function_privilege('anon', 'ceaute.get_provider_booking_counts_by_local_date(uuid)', 'execute'),
  'anon has no execute privilege'
);
insert into tap_results (result) select ok(
  has_function_privilege('authenticated', 'ceaute.get_provider_booking_counts_by_local_date(uuid)', 'execute'),
  'authenticated has execute privilege'
);

-- The owner of page A.
set local role authenticated;
select set_config('request.jwt.claim.sub', '02100000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select confirmed_count from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date = (select busy_date from count_dates)),
  2,
  'Confirmed bookings are counted per London date'
);
insert into tap_results (result) select is(
  (select in_progress_count from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date = (select busy_date from count_dates)),
  1,
  'Only unexpired holds are counted as payments in progress'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date = (select quiet_date from count_dates)),
  0,
  'Expired holds, cancelled and completed bookings produce no row'
);
insert into tap_results (result) select is(
  (select confirmed_count from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date = (select bst_utc_date + 1 from count_dates)),
  1,
  'A 23:30 UTC booking during BST counts on the next London date'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date = (select bst_utc_date from count_dates)),
  0,
  'The 23:30 UTC booking is not counted on its UTC date'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')
   where local_date < (select london_today from count_dates)),
  0,
  'Dates before London today are excluded'
);
insert into tap_results (result) select results_eq(
  $$select local_date, confirmed_count, in_progress_count
    from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')$$,
  $$select busy_date, 2, 1 from count_dates
    union all
    select bst_utc_date + 1, 1, 0 from count_dates$$,
  'The owner sees exactly one row per counted date, earliest first'
);

-- Another signed-in provider.
select set_config('request.jwt.claim.sub', '02100000-0000-0000-0000-000000000003', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')),
  0,
  'Another authenticated user gets no rows for the page'
);

-- Signed out.
reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

insert into tap_results (result) select throws_ok(
  $$select * from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'anon cannot execute the function'
);

-- Lock-in: a hold created before its date is blocked can still complete, and
-- no new hold can be created on that date afterwards.
reset role;
set local role service_role;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table lockin_hold as
select ceaute.create_validated_booking_hold(
  '02100000-0000-0000-0000-000000000001',
  '12100000-0000-0000-0000-000000000002',
  '22100000-0000-0000-0000-000000000002',
  array[]::uuid[],
  (select pg_temp.london_at(lockin_date, '12:00') from count_dates)
) as id;

insert into tap_results (result) select ok((select id from lockin_hold) is not null,
  'A hold is created before its date is blocked');

reset role;
insert into ceaute.blocked_date (provider_page_id, local_date)
select '12100000-0000-0000-0000-000000000002', lockin_date from count_dates;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table lockin_claim as
select * from ceaute.claim_booking_checkout(
  (select id from lockin_hold), 5000, 5000, 0, 500, 'gbp', 'acct_counts'
);

select ceaute.record_booking_checkout_session(
  (select payment_attempt_id from lockin_claim),
  (select claim_token from lockin_claim),
  'cs_counts_lockin', null, 'https://checkout.stripe.test/counts-lockin', now() + interval '30 minutes'
);

insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    (select payment_attempt_id from lockin_claim),
    'pi_counts_lockin', 'cs_counts_lockin', 'paid', 'gbp', 5000)),
  'confirmed',
  'A hold created before the block still completes through payment'
);

reset role;
insert into tap_results (result) select ok(
  (select booking.status = 'confirmed'
   from ceaute.booking
   join ceaute.blocked_date
     on blocked_date.provider_page_id = booking.provider_page_id
    and blocked_date.local_date = (booking.start_at at time zone 'Europe/London')::date
   where booking.id = (select id from lockin_hold)),
  'The completed booking is confirmed on the blocked date'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select throws_matching(
  format(
    'select ceaute.create_validated_booking_hold(%L,%L,%L,array[]::uuid[],%L)',
    '02100000-0000-0000-0000-000000000001', '12100000-0000-0000-0000-000000000002',
    '22100000-0000-0000-0000-000000000002',
    (select pg_temp.london_at(lockin_date, '14:00') from count_dates)
  ),
  'Requested date is blocked',
  'A new hold on the blocked date is rejected'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '02100000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select format('%s/%s', confirmed_count, in_progress_count)
   from ceaute.get_provider_booking_counts_by_local_date('12100000-0000-0000-0000-000000000002')
   where local_date = (select lockin_date from count_dates)),
  '1/0',
  'The owner sees the completed booking on the blocked date'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
