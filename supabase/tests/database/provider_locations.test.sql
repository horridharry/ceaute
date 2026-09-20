begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

-- The transactional-email trigger is a deferred constraint trigger, so it would
-- otherwise fire at commit, which this test never reaches. Making it immediate
-- is what lets the assertions below say anything at all about who gets emailed.
set constraints all immediate;

select plan(54);

create temp table tap_results (result text);
grant insert, select on table tap_results to anon, authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'locations-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'locations-provider-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '0a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'locations-provider-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Locations Test', phone_e164 = '+447700900777'
where id in (
  '0a000000-0000-0000-0000-000000000001',
  '0a000000-0000-0000-0000-000000000002',
  '0a000000-0000-0000-0000-000000000003'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('0b000000-0000-0000-0000-000000000001', '0a000000-0000-0000-0000-000000000002', 'locations.one', 'Whitney Locations', 'Moves around', 'Nails', 'published'),
  ('0b000000-0000-0000-0000-000000000002', '0a000000-0000-0000-0000-000000000003', 'locations.two', 'Other Provider', 'Stays put', 'Nails', 'published');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select provider_page_id, weekday, '09:00', '17:00'
from unnest(array[
  '0b000000-0000-0000-0000-000000000001'::uuid,
  '0b000000-0000-0000-0000-000000000002'::uuid
]) as provider_page_id
cross join generate_series(0, 6) as weekday;

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, commitment_amount_pence, cancellation_window_hours
)
values
  ('0b000000-0000-0000-0000-000000000001', 'full', 1000, 24),
  ('0b000000-0000-0000-0000-000000000002', 'full', 1000, 24);

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence,
  discovery_category_id, is_active
)
select
  treatments.id,
  treatments.provider_page_id,
  'Locations treatment',
  'Fixture',
  60,
  5000,
  (select id from ceaute.discovery_category where slug = 'manicure'),
  true
from (
  values
    ('0c000000-0000-0000-0000-000000000001'::uuid, '0b000000-0000-0000-0000-000000000001'::uuid),
    ('0c000000-0000-0000-0000-000000000002'::uuid, '0b000000-0000-0000-0000-000000000002'::uuid)
) as treatments (id, provider_page_id);

insert into ceaute.portfolio_image (provider_page_id, storage_path, is_visible)
values
  ('0b000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001/one.webp', true),
  ('0b000000-0000-0000-0000-000000000002', '0b000000-0000-0000-0000-000000000002/two.webp', true);

insert into ceaute.provider_payment_account (
  provider_page_id, stripe_account_id, dashboard, identity_country,
  recipient_applied, stripe_transfers_status, payouts_status,
  requirements_currently_due, requirements_past_due, requirements_eventually_due,
  last_stripe_update_at
)
values
  ('0b000000-0000-0000-0000-000000000001', 'acct_locations_one', 'express', 'GB', true, 'active', 'active', array[]::text[], array[]::text[], array[]::text[], now()),
  ('0b000000-0000-0000-0000-000000000002', 'acct_locations_two', 'express', 'GB', true, 'active', 'active', array[]::text[], array[]::text[], array[]::text[], now());

-- The provider with one saved location. Nothing names is_primary, exactly as
-- every environment that existed before this feature.
insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
values (
  '0b000000-0000-0000-0000-000000000002', 'Brighton Lanes', '1 Other Street',
  'Brighton', 'BN1 1AA', 'Ring the bell', true
);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000002' and is_primary),
  1,
  'A provider with one saved location is working from it'
);

-- The migration's one-shot backfill, exercised rather than assumed. Disabling
-- the trigger is the only way to recreate the pre-feature state it exists for:
-- saved locations with none of them current.
alter table ceaute.provider_location disable trigger provider_location_set_first_primary;

insert into ceaute.provider_location (
  id, provider_page_id, public_area, address_line_1, city, postcode, is_active, is_primary
)
values
  ('0d000000-0000-0000-0000-00000000000a', '0b000000-0000-0000-0000-000000000002', 'Older Area', '8 Old Road', 'Brighton', 'BN2 2BB', false, false),
  ('0d000000-0000-0000-0000-00000000000b', '0b000000-0000-0000-0000-000000000002', 'Newer Area', '9 New Road', 'Brighton', 'BN3 3CC', true, false);

update ceaute.provider_location set is_primary = false
where provider_page_id = '0b000000-0000-0000-0000-000000000002';

with ranked_locations as (
  select
    id,
    row_number() over (
      partition by provider_page_id
      order by is_active desc, created_at, id
    ) as location_rank
  from ceaute.provider_location
)
update ceaute.provider_location
set is_primary = true
from ranked_locations
where ranked_locations.id = provider_location.id
  and ranked_locations.location_rank = 1
  and provider_location.is_primary = false
  and not exists (
    select 1
    from ceaute.provider_location as existing_location
    where existing_location.provider_page_id = provider_location.provider_page_id
      and existing_location.is_primary
  );

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000002' and is_primary),
  1,
  'The backfill leaves exactly one current location per provider page'
);
insert into tap_results (result) select ok(
  (select is_active from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000002' and is_primary),
  'The backfill prefers an active location when a page has more than one row'
);

-- Put the fixture back exactly as it was, so the assertions that follow are
-- about the feature and not about this rehearsal of the migration.
alter table ceaute.provider_location disable trigger provider_location_protect_primary;

update ceaute.provider_location set is_primary = false
where provider_page_id = '0b000000-0000-0000-0000-000000000002';

delete from ceaute.provider_location
where id in ('0d000000-0000-0000-0000-00000000000a', '0d000000-0000-0000-0000-00000000000b');

update ceaute.provider_location set is_primary = true
where provider_page_id = '0b000000-0000-0000-0000-000000000002';

alter table ceaute.provider_location enable trigger provider_location_protect_primary;
alter table ceaute.provider_location enable trigger provider_location_set_first_primary;

-- Whitney: Huddersfield first, then London, then Leeds.
insert into ceaute.provider_location (
  id, provider_page_id, public_area, address_line_1, city, postcode, access_instructions, is_active
)
values (
  '0d000000-0000-0000-0000-000000000001', '0b000000-0000-0000-0000-000000000001',
  'Huddersfield Town Centre', '2 Student Road', 'Huddersfield', 'HD1 1AA',
  'Second buzzer', true
);

insert into tap_results (result) select ok(
  (select is_primary from ceaute.provider_location
   where id = '0d000000-0000-0000-0000-000000000001'),
  'The first saved location becomes the one the provider is working from'
);

-- A second saved location, inserted with is_primary asked for explicitly by a
-- privileged caller. PostgreSQL decides, not the caller.
insert into ceaute.provider_location (
  id, provider_page_id, public_area, address_line_1, city, postcode, is_active, is_primary
)
values (
  '0d000000-0000-0000-0000-000000000002', '0b000000-0000-0000-0000-000000000001',
  'Shoreditch, London', '10 Studio Lane', 'London', 'E1 6AN', true, true
);

insert into ceaute.provider_location (
  id, provider_page_id, public_area, address_line_1, city, postcode, is_active
)
values (
  '0d000000-0000-0000-0000-000000000003', '0b000000-0000-0000-0000-000000000001',
  'Leeds City Centre', '3 Temporary Way', 'Leeds', 'LS1 1AA', true
);

-- Half-filled in, the way a location looks while a provider is still typing it.
insert into ceaute.provider_location (
  id, provider_page_id, public_area, is_active
)
values (
  '0d000000-0000-0000-0000-000000000004', '0b000000-0000-0000-0000-000000000001',
  'Somewhere In Portugal', true
);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001'),
  4,
  'A provider can save several locations'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001' and is_primary),
  1,
  'Saving more locations never produces a second current one'
);
insert into tap_results (result) select is(
  (select id from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001' and is_primary),
  '0d000000-0000-0000-0000-000000000001'::uuid,
  'A later saved location does not quietly take over as the current one'
);

-- The index is the last line of defence if the trigger is ever bypassed.
insert into tap_results (result) select throws_ok(
  $$update ceaute.provider_location set is_primary = true
    where id = '0d000000-0000-0000-0000-000000000002'$$,
  '23505',
  null,
  'PostgreSQL refuses two current locations for one provider'
);

insert into tap_results (result) select is(
  (select public_area from ceaute.get_public_provider_location('0b000000-0000-0000-0000-000000000001')),
  'Huddersfield Town Centre'::varchar,
  'The public page shows the location the provider is working from'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('Huddersfield', null)
   where username = 'locations.one'),
  1,
  'Discovery finds the provider in the area they are working from, once'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('Shoreditch', null)
   where username = 'locations.one'),
  0,
  'Discovery does not find the provider in a saved location they have left'
);

-- What a provider may and may not write directly ----------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location),
  4,
  'A provider reads their own saved locations and no others'
);
insert into tap_results (result) select throws_matching(
  $$select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000004')$$,
  'complete private address',
  'A published page cannot start working from a location with no address'
);
insert into tap_results (result) select throws_matching(
  $$update ceaute.provider_location set is_primary = true
    where id = '0d000000-0000-0000-0000-000000000002'$$,
  'permission denied',
  'A provider cannot move themselves by writing the column'
);
insert into tap_results (result) select lives_ok(
  $$update ceaute.provider_location set public_area = 'Shoreditch, London E1'
    where id = '0d000000-0000-0000-0000-000000000002'$$,
  'A provider can edit a saved location'
);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table booking_times as
select
  (((now() at time zone 'Europe/London')::date + 3)::timestamp + time '12:00') at time zone 'Europe/London' as first_start,
  (((now() at time zone 'Europe/London')::date + 4)::timestamp + time '12:00') at time zone 'Europe/London' as second_start,
  (((now() at time zone 'Europe/London')::date + 5)::timestamp + time '12:00') at time zone 'Europe/London' as legacy_start,
  (((now() at time zone 'Europe/London')::date + 6)::timestamp + time '12:00') at time zone 'Europe/London' as paid_after_move_start;

grant select on table booking_times to anon, authenticated, service_role;

create temp table huddersfield_hold as
select ceaute.create_validated_booking_hold(
  '0a000000-0000-0000-0000-000000000001',
  '0b000000-0000-0000-0000-000000000001',
  '0c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select first_start from booking_times)
) as id;

grant select on table huddersfield_hold to anon, authenticated, service_role;

-- A hold with the other provider, to prove one provider's move leaves every
-- other provider's bookings alone.
create temp table other_provider_hold as
select ceaute.create_validated_booking_hold(
  '0a000000-0000-0000-0000-000000000001',
  '0b000000-0000-0000-0000-000000000002',
  '0c000000-0000-0000-0000-000000000002',
  array[]::uuid[],
  (select first_start from booking_times)
) as id;

grant select on table other_provider_hold to anon, authenticated, service_role;

create temp table legacy_hold as
select ceaute.create_validated_booking_hold(
  '0a000000-0000-0000-0000-000000000001',
  '0b000000-0000-0000-0000-000000000001',
  '0c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select legacy_start from booking_times)
) as id;

grant select on table legacy_hold to anon, authenticated, service_role;

reset role;

-- Every hold that existed when this migration was applied looks like this: no
-- location recorded, because the column did not exist when it was taken.
update ceaute.booking set provider_location_id = null
where id = (select id from legacy_hold);

insert into tap_results (result) select is(
  (select provider_location_id from ceaute.booking where id = (select id from huddersfield_hold)),
  '0d000000-0000-0000-0000-000000000001'::uuid,
  'A hold records the saved location the provider was working from'
);
insert into tap_results (result) select is(
  (select service_snapshot ->> 'address_line_1' from ceaute.booking
   where id = (select id from huddersfield_hold)),
  '2 Student Road',
  'A hold snapshots that location''s private address'
);
insert into tap_results (result) select is(
  (select service_snapshot ->> 'public_area' from ceaute.booking
   where id = (select id from huddersfield_hold)),
  'Huddersfield Town Centre',
  'A hold snapshots that location''s public area'
);

-- Moving --------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  $$select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000002')$$,
  'Location not found',
  'A provider cannot move another provider to a different location'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001'),
  0,
  'A provider cannot read another provider''s saved locations'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

insert into tap_results (result) select throws_matching(
  $$select address_line_1 from ceaute.provider_location$$,
  'permission denied',
  'An unauthenticated visitor cannot read private addresses'
);
insert into tap_results (result) select throws_matching(
  $$select public_area from ceaute.provider_location$$,
  'permission denied',
  'An unauthenticated visitor cannot read a public area from the table either'
);

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('Student Road', null)),
  0,
  'Discovery cannot be used to search a provider''s private address'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('Leeds', null)
   where username = 'locations.one'),
  0,
  'A saved location the provider is not working from is not discoverable'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select lives_ok(
  $$select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000002')$$,
  'A provider can start working from another saved location'
);

reset role;

insert into tap_results (result) select is(
  (select pg_get_function_result(oid) from pg_proc
   where pronamespace = 'ceaute'::regnamespace
     and proname = 'get_public_provider_location'),
  'TABLE(public_area character varying)',
  'The public location projection has no column a private address could travel in'
);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001' and is_primary),
  1,
  'Moving leaves exactly one current location'
);
insert into tap_results (result) select is(
  (select id from ceaute.provider_location
   where provider_page_id = '0b000000-0000-0000-0000-000000000001' and is_primary),
  '0d000000-0000-0000-0000-000000000002'::uuid,
  'The chosen location is the current one after the move'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from huddersfield_hold)),
  'cancelled',
  'Moving retires an unpaid hold taken against the location left behind'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from other_provider_hold)),
  'awaiting_payment',
  'Moving leaves another provider''s holds alone'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from huddersfield_hold)),
  0,
  'Retiring a stale hold tells nobody, exactly as an expired hold tells nobody'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from legacy_hold)),
  'cancelled',
  'A hold taken before this feature shipped, carrying no location, is retired too'
);
insert into tap_results (result) select is(
  (select public_area from ceaute.get_public_provider_location('0b000000-0000-0000-0000-000000000001')),
  'Shoreditch, London E1'::varchar,
  'The public page reflects the new current location'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('London', null)
   where username = 'locations.one'),
  1,
  'Discovery follows the provider to the location they moved to, once'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.search_public_providers('Huddersfield', null)
   where username = 'locations.one'),
  0,
  'Discovery stops matching the area the provider left'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.get_public_availability_rules('0b000000-0000-0000-0000-000000000001')),
  7,
  'Availability stays provider-wide and is unchanged by the move'
);

-- A confirmed booking -------------------------------------------------------

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table london_hold as
select ceaute.create_validated_booking_hold(
  '0a000000-0000-0000-0000-000000000001',
  '0b000000-0000-0000-0000-000000000001',
  '0c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select second_start from booking_times)
) as id;

grant select on table london_hold to anon, authenticated, service_role;

insert into tap_results (result) select is(
  (select provider_location_id from ceaute.booking where id = (select id from london_hold)),
  '0d000000-0000-0000-0000-000000000002'::uuid,
  'A hold taken after the move records the new current location'
);

reset role;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  payment_status, provider_stripe_account_id
)
select
  '0e000000-0000-0000-0000-000000000001',
  (select id from london_hold),
  1,
  'ceaute-checkout-locations-1',
  'cs_locations_1',
  'pi_locations_1',
  5000, 5000, 0,
  'checkout_created',
  'acct_locations_one';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    '0e000000-0000-0000-0000-000000000001', 'pi_locations_1', 'cs_locations_1',
    'paid', 'gbp', 5000
  )),
  'confirmed',
  'The verified payment webhook still confirms a hold'
);
-- Without this, the assertion above about an empty outbox could pass simply
-- because nothing in this transaction ever writes to the outbox.
insert into tap_results (result) select cmp_ok(
  (select count(*)::integer from ceaute.booking_email_outbox
   where booking_id = (select id from london_hold)),
  '>',
  0,
  'Confirmation still enqueues transactional email, so an empty outbox means something'
);

insert into tap_results (result) select throws_ok(
  $$select ceaute.create_validated_booking_hold(
    '0a000000-0000-0000-0000-000000000001',
    '0b000000-0000-0000-0000-000000000001',
    '0c000000-0000-0000-0000-000000000001',
    array[]::uuid[],
    (select second_start from booking_times)
  )$$,
  '23P01',
  null,
  'Double-booking protection still refuses an overlapping appointment'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select lives_ok(
  $$select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000001')$$,
  'A provider can move back to an earlier saved location'
);

reset role;

insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from london_hold)),
  'confirmed',
  'Moving away never cancels a booking the customer has already paid for'
);
insert into tap_results (result) select is(
  (select service_snapshot ->> 'address_line_1' from ceaute.booking
   where id = (select id from london_hold)),
  '10 Studio Lane',
  'A confirmed booking keeps the address it was sold with'
);

-- Paying after the provider has moved ---------------------------------------

-- The one window the move cannot close: a Stripe Checkout Session opened before
-- the move stays payable for up to 31 more minutes. What matters is that such a
-- payment can never become a booking at an address the provider has left, and
-- that the customer gets all of their money back.

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table paid_after_move_hold as
select ceaute.create_validated_booking_hold(
  '0a000000-0000-0000-0000-000000000001',
  '0b000000-0000-0000-0000-000000000001',
  '0c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select paid_after_move_start from booking_times)
) as id;

grant select on table paid_after_move_hold to anon, authenticated, service_role;

reset role;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  payment_status, provider_stripe_account_id
)
select
  '0e000000-0000-0000-0000-000000000002',
  (select id from paid_after_move_hold),
  1,
  'ceaute-checkout-locations-2',
  'cs_locations_2',
  'pi_locations_2',
  5000, 5000, 0,
  'checkout_created',
  'acct_locations_one';

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000003');

reset role;
set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    '0e000000-0000-0000-0000-000000000002', 'pi_locations_2', 'cs_locations_2',
    'paid', 'gbp', 5000
  )),
  'refund_required',
  'A payment that lands after the move cannot confirm the stale booking'
);

reset role;

insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from paid_after_move_hold)),
  'cancelled',
  'The stale booking stays cancelled however late the payment arrives'
);
insert into tap_results (result) select is(
  (select expected_amount_pence from ceaute.booking_refund_operation
   where booking_payment_attempt_id = '0e000000-0000-0000-0000-000000000002'),
  5000::bigint,
  'The whole payment becomes a refund entitlement, so the customer loses nothing'
);

-- A hold cannot be taken against a location that could not host an appointment,
-- whatever leaves the page in that state.
update ceaute.provider_location set postcode = null
where id = '0d000000-0000-0000-0000-000000000003';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select throws_matching(
  $$select ceaute.create_validated_booking_hold(
    '0a000000-0000-0000-0000-000000000001',
    '0b000000-0000-0000-0000-000000000001',
    '0c000000-0000-0000-0000-000000000001',
    array[]::uuid[],
    (((now() at time zone 'Europe/London')::date + 7)::timestamp + time '12:00') at time zone 'Europe/London'
  )$$,
  'Provider location is unavailable',
  'A booking is refused rather than snapshotted with no address'
);

reset role;
update ceaute.provider_location set postcode = 'LS1 1AA'
where id = '0d000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ceaute.set_primary_provider_location('0d000000-0000-0000-0000-000000000001');
reset role;

-- Deleting a location the provider has left ---------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  $$delete from ceaute.provider_location where id = '0d000000-0000-0000-0000-000000000001'$$,
  'current location cannot be deleted',
  'The location a provider is working from cannot be deleted'
);
insert into tap_results (result) select lives_ok(
  $$delete from ceaute.provider_location where id = '0d000000-0000-0000-0000-000000000002'$$,
  'A saved location the provider has left can be deleted'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.provider_location
   where id = '0d000000-0000-0000-0000-000000000002'),
  0,
  'Deletion removes the saved location outright, with nothing archived'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

with attempted_delete as (
  delete from ceaute.provider_location
  where id = '0d000000-0000-0000-0000-000000000003'
  returning 1
)
insert into tap_results (result) select is(
  (select count(*)::integer from attempted_delete),
  0,
  'A provider cannot delete another provider''s saved location'
);

reset role;

insert into tap_results (result) select is(
  (select service_snapshot ->> 'address_line_1' from ceaute.booking
   where id = (select id from london_hold)),
  '10 Studio Lane',
  'A historical booking survives the deletion of the location it happened at'
);
insert into tap_results (result) select is(
  (select provider_location_id from ceaute.booking where id = (select id from london_hold)),
  '0d000000-0000-0000-0000-000000000002'::uuid,
  'Deleting a location never rewrites a booking row'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '0a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select outcome from ceaute.prepare_booking_cancellation(
    (select id from london_hold), 'customer'
  )),
  'cancelled',
  'Customer cancellation still works after the provider has moved'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
