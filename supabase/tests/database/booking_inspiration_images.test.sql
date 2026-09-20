begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(64);

create temp table tap_results (result text);
grant insert, select on table tap_results to anon, authenticated, service_role;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'inspiration-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'inspiration-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'inspiration-other-customer@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '1a000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'inspiration-other-provider@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Inspiration Test', phone_e164 = '+447700900888'
where id in (
  '1a000000-0000-0000-0000-000000000001',
  '1a000000-0000-0000-0000-000000000002',
  '1a000000-0000-0000-0000-000000000003',
  '1a000000-0000-0000-0000-000000000004'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('1b000000-0000-0000-0000-000000000001', '1a000000-0000-0000-0000-000000000002', 'inspiration.one', 'Inspiration Provider', 'Fixture', 'Nails', 'published'),
  ('1b000000-0000-0000-0000-000000000002', '1a000000-0000-0000-0000-000000000004', 'inspiration.two', 'Other Provider', 'Fixture', 'Nails', 'published');

insert into ceaute.availability_rule (provider_page_id, weekday, starts_at, ends_at)
select '1b000000-0000-0000-0000-000000000001', weekday, '09:00', '17:00'
from generate_series(0, 6) as weekday;

insert into ceaute.provider_booking_setting (
  provider_page_id, payment_mode, commitment_amount_pence, cancellation_window_hours
)
values ('1b000000-0000-0000-0000-000000000001', 'full', 1000, 24);

insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values (
  '1c000000-0000-0000-0000-000000000001', '1b000000-0000-0000-0000-000000000001',
  'Inspiration treatment', 'Fixture', 60, 5000, true
);

insert into ceaute.provider_location (
  provider_page_id, public_area, address_line_1, city, postcode, is_active
)
values (
  '1b000000-0000-0000-0000-000000000001', 'Central London', '4 Private Street',
  'London', 'EC2A 1AA', true
);

create temp table inspiration_times as
select
  (((now() at time zone 'Europe/London')::date + 3)::timestamp + time '10:00') at time zone 'Europe/London' as held_start,
  (((now() at time zone 'Europe/London')::date + 4)::timestamp + time '10:00') at time zone 'Europe/London' as confirmed_start,
  (((now() at time zone 'Europe/London')::date + 5)::timestamp + time '10:00') at time zone 'Europe/London' as abandoned_start,
  (((now() at time zone 'Europe/London')::date + 6)::timestamp + time '10:00') at time zone 'Europe/London' as with_images_start,
  (((now() at time zone 'Europe/London')::date + 7)::timestamp + time '10:00') at time zone 'Europe/London' as cancelled_hold_start,
  (((now() at time zone 'Europe/London')::date + 8)::timestamp + time '10:00') at time zone 'Europe/London' as just_expired_start;

grant select on table inspiration_times to anon, authenticated, service_role;

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

create temp table held_booking as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select held_start from inspiration_times)
) as id;

create temp table confirmed_booking as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select confirmed_start from inspiration_times)
) as id;

create temp table abandoned_booking as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select abandoned_start from inspiration_times)
) as id;

create temp table with_images_booking as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select with_images_start from inspiration_times)
) as id;

create temp table just_expired_hold as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select just_expired_start from inspiration_times)
) as id;

create temp table cancelled_hold as
select ceaute.create_validated_booking_hold(
  '1a000000-0000-0000-0000-000000000001',
  '1b000000-0000-0000-0000-000000000001',
  '1c000000-0000-0000-0000-000000000001',
  array[]::uuid[],
  (select cancelled_hold_start from inspiration_times)
) as id;

grant select on table held_booking, confirmed_booking, abandoned_booking,
  with_images_booking, cancelled_hold, just_expired_hold
to anon, authenticated, service_role;

reset role;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  payment_status, provider_stripe_account_id
)
select
  '1e000000-0000-0000-0000-000000000001',
  (select id from confirmed_booking),
  1, 'ceaute-checkout-inspiration-1', 'cs_inspiration_1', 'pi_inspiration_1',
  5000, 5000, 0, 'checkout_created', 'acct_inspiration_one';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
select ceaute.complete_booking_payment_attempt(
  '1e000000-0000-0000-0000-000000000001', 'pi_inspiration_1', 'cs_inspiration_1',
  'paid', 'gbp', 5000
);
reset role;

-- A booking with no images at all -------------------------------------------

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image),
  0,
  'Booking does not require inspiration images'
);
insert into tap_results (result) select is(
  (select status from ceaute.booking where id = (select id from confirmed_booking)),
  'confirmed',
  'A booking with no inspiration images confirms exactly as before'
);

-- What the owning customer may do -------------------------------------------

-- Confirming a booking that already carries images is the promise this feature
-- must not break, and it is not the same case as confirming one without any.
set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ceaute.add_booking_inspiration_image(
  (select id from with_images_booking),
  (select id from with_images_booking) || '/before-paying.jpg',
  'image/jpeg', 120000
);
reset role;

insert into ceaute.booking_payment_attempt (
  id, booking_id, attempt_number, checkout_idempotency_key,
  stripe_checkout_session_id, stripe_payment_intent_id,
  amount_charged_pence, total_booking_value_pence, amount_due_later_pence,
  payment_status, provider_stripe_account_id
)
select
  '1e000000-0000-0000-0000-000000000002',
  (select id from with_images_booking),
  1, 'ceaute-checkout-inspiration-2', 'cs_inspiration_2', 'pi_inspiration_2',
  5000, 5000, 0, 'checkout_created', 'acct_inspiration_one';

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);
insert into tap_results (result) select is(
  (select outcome from ceaute.complete_booking_payment_attempt(
    '1e000000-0000-0000-0000-000000000002', 'pi_inspiration_2', 'cs_inspiration_2',
    'paid', 'gbp', 5000
  )),
  'confirmed',
  'A booking carrying inspiration images confirms exactly as one without them'
);
reset role;

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from with_images_booking)),
  1,
  'Confirmation keeps the images the customer attached before paying'
);

-- What the owning customer may do, continued ---------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/first.jpg'
  ),
  'A customer can attach an inspiration image to their held booking'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/png', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/second.png'
  ),
  'PNG is accepted'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/webp', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/third.webp'
  ),
  'WebP is accepted'
);
insert into tap_results (result) select throws_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/gif', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/fourth.gif'
  ),
  '23514',
  null,
  'An unsupported image type is refused'
);
insert into tap_results (result) select throws_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 10485761)$$,
    (select id from held_booking),
    (select id from held_booking) || '/toobig.jpg'
  ),
  '23514',
  null,
  'An image over 10 MB is refused'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 10485760)$$,
    (select id from held_booking),
    (select id from held_booking) || '/exactly-ten-mb.jpg'
  ),
  'An image of exactly 10 MB is accepted'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/fifth.jpg'
  ),
  'A fifth image is accepted'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from held_booking)),
  5,
  'A booking can carry five inspiration images'
);
insert into tap_results (result) select throws_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/sixth.jpg'
  ),
  '23514',
  null,
  'A sixth image is refused'
);

-- Every place is taken, so there is nowhere for a sixth to go even if the
-- counting operation above were bypassed entirely.
insert into tap_results (result) select is(
  (select count(distinct slot)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from held_booking)),
  5,
  'The five places per booking are what the limit actually is'
);

insert into tap_results (result) select lives_ok(
  format(
    $$delete from ceaute.booking_inspiration_image
      where booking_id = %L and storage_path like '%%fifth.jpg'$$,
    (select id from held_booking)
  ),
  'A customer can remove an image before paying'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/replacement.jpg'
  ),
  'Removing an image frees a place for another'
);

-- After confirmation ---------------------------------------------------------

insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/added-later.jpg'
  ),
  'A customer who had no images at checkout can add them after confirmation'
);
insert into tap_results (result) select lives_ok(
  format(
    $$delete from ceaute.booking_inspiration_image
      where booking_id = %L and storage_path like '%%added-later.jpg'$$,
    (select id from confirmed_booking)
  ),
  'A customer can remove an image from a confirmed booking'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/kept.jpg'
  ),
  'An image added after confirmation is kept'
);

-- Nobody else -----------------------------------------------------------------

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000003', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image),
  0,
  'A different customer cannot see another customer''s inspiration images'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/intruder.jpg'
  ),
  'cannot take inspiration images',
  'A different customer cannot attach an image to someone else''s booking'
);

with attempted_delete as (
  delete from ceaute.booking_inspiration_image
  where booking_id = (select id from confirmed_booking)
  returning 1
)
insert into tap_results (result) select is(
  (select count(*)::integer from attempted_delete),
  0,
  'A different customer cannot remove another customer''s inspiration images'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000004', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image),
  0,
  'A different provider cannot see another provider''s booking images'
);

-- The provider for this booking -----------------------------------------------

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000002', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from confirmed_booking)),
  1,
  'The provider can view the images for an appointment they were booked for'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from held_booking)),
  0,
  'The provider cannot see images on a hold that was never paid for'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/provider-upload.jpg'
  ),
  'cannot take inspiration images',
  'The provider cannot add an image to their customer''s booking'
);

with attempted_delete as (
  delete from ceaute.booking_inspiration_image
  where booking_id = (select id from confirmed_booking)
  returning 1
)
insert into tap_results (result) select is(
  (select count(*)::integer from attempted_delete),
  0,
  'The provider cannot remove their customer''s inspiration images'
);

-- An expired hold ---------------------------------------------------------------

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);

insert into tap_results (result) select ok(
  ceaute.can_manage_booking_inspiration_images((select id from held_booking)),
  'A live hold can take images'
);

reset role;
update ceaute.booking set expires_at = now() - interval '1 minute'
where id = (select id from held_booking);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select ok(
  not ceaute.can_manage_booking_inspiration_images((select id from held_booking)),
  'A hold that has run out can no longer take images'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from held_booking),
    (select id from held_booking) || '/too-late.jpg'
  ),
  'cannot take inspiration images',
  'An expired hold refuses another image'
);

with attempted_delete as (
  delete from ceaute.booking_inspiration_image
  where booking_id = (select id from held_booking)
  returning 1
)
insert into tap_results (result) select is(
  (select count(*)::integer from attempted_delete),
  0,
  'An expired hold refuses to let its images be removed'
);

reset role;
update ceaute.booking set expires_at = now() + interval '5 minutes'
where id = (select id from held_booking);

-- Replacing in place ------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  format(
    $$update ceaute.booking_inspiration_image set storage_path = %L
      where booking_id = %L$$,
    (select id from held_booking) || '/repointed.jpg',
    (select id from held_booking)
  ),
  'permission denied',
  'Nobody can repoint an image row at another file'
);

reset role;
insert into tap_results (result) select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'booking_inspiration_images%'
     and cmd = 'UPDATE'),
  0,
  'There is no way to overwrite a stored inspiration image in place'
);

-- A stored object, end to end ----------------------------------------------------

insert into storage.objects (bucket_id, name, owner)
values (
  'booking-inspiration-images',
  (select id from confirmed_booking) || '/readable.jpg',
  '1a000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'booking-inspiration-images'
     and name = (select id from confirmed_booking) || '/readable.jpg'),
  1,
  'The owning customer can read their stored object'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000002', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'booking-inspiration-images'
     and name = (select id from confirmed_booking) || '/readable.jpg'),
  1,
  'The provider for that appointment can read the stored object'
);

-- Storage refuses a direct DELETE from SQL and insists on its own API, so the
-- delete policy is asserted by its text here and exercised for real against the
-- local Storage endpoint (see the report's manual verification).
insert into tap_results (result) select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'booking_inspiration_images_delete_owning_customer'
     and cmd = 'DELETE'
     and qual like '%can_manage_booking_inspiration_images%'),
  1,
  'Deleting a stored object asks the same question as removing its record'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000003', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'booking-inspiration-images'),
  0,
  'A different customer can read none of the stored objects'
);

-- A path that is not a booking ----------------------------------------------------

reset role;
insert into tap_results (result) select is(
  ceaute.storage_object_booking_id('not-a-uuid/photo.jpg'),
  null::uuid,
  'A path whose folder is not a booking answers with nothing instead of raising'
);
insert into tap_results (result) select is(
  ceaute.storage_object_booking_id('photo.jpg'),
  null::uuid,
  'A path with no folder at all answers with nothing instead of raising'
);
insert into tap_results (result) select lives_ok(
  $$select count(*) from storage.objects where bucket_id = 'portfolio-images'$$,
  'Reading another bucket is unaffected by these policies'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from held_booking) || '/wrong-folder.jpg'
  ),
  'must be stored under its own booking',
  'An image record cannot name a file belonging to another booking'
);

-- Nobody at all ----------------------------------------------------------------

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);

insert into tap_results (result) select throws_matching(
  $$select storage_path from ceaute.booking_inspiration_image$$,
  'permission denied',
  'An unauthenticated visitor cannot read inspiration images'
);

reset role;

insert into tap_results (result) select ok(
  not (select public from storage.buckets where id = 'booking-inspiration-images'),
  'The inspiration image bucket is private, so there are no permanent public URLs'
);
insert into tap_results (result) select is(
  (select file_size_limit from storage.buckets where id = 'booking-inspiration-images'),
  10485760::bigint,
  'Storage enforces the 10 MB limit on the object itself'
);
insert into tap_results (result) select set_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'booking-inspiration-images'$$,
  array['image/jpeg', 'image/png', 'image/webp'],
  'Storage accepts only the three image types'
);

-- Once the appointment is history ----------------------------------------------

update ceaute.booking set status = 'completed'
where id = (select id from confirmed_booking);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from confirmed_booking)),
  1,
  'The customer can still see the images on a completed booking'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/after-completion.jpg'
  ),
  'cannot take inspiration images',
  'A completed booking''s images are read-only'
);

with attempted_delete as (
  delete from ceaute.booking_inspiration_image
  where booking_id = (select id from confirmed_booking)
  returning 1
)
insert into tap_results (result) select is(
  (select count(*)::integer from attempted_delete),
  0,
  'A completed booking''s images cannot be removed'
);

reset role;
update ceaute.booking set status = 'cancelled', cancelled_at = now(), cancelled_by = 'customer'
where id = (select id from confirmed_booking);

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.add_booking_inspiration_image(%L, %L, 'image/jpeg', 120000)$$,
    (select id from confirmed_booking),
    (select id from confirmed_booking) || '/after-cancellation.jpg'
  ),
  'cannot take inspiration images',
  'A cancelled booking''s images are read-only'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from confirmed_booking)),
  1,
  'A cancelled booking keeps its images, and its customer can still see them'
);

reset role;

-- The booking nobody ever paid for ------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ceaute.add_booking_inspiration_image(
  (select id from abandoned_booking),
  (select id from abandoned_booking) || '/abandoned.jpg',
  'image/jpeg',
  120000
);
reset role;

set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select ceaute.add_booking_inspiration_image(
  (select id from just_expired_hold),
  (select id from just_expired_hold) || '/just-expired.jpg',
  'image/jpeg',
  120000
);
select ceaute.add_booking_inspiration_image(
  (select id from cancelled_hold),
  (select id from cancelled_hold) || '/cancelled.jpg',
  'image/jpeg',
  120000
);
reset role;

-- The hold ran out a while ago: long enough that no payment can still be in
-- flight for it, which is what the cleanup pass waits for.
update ceaute.booking set expires_at = now() - interval '10 minutes'
where id = (select id from abandoned_booking);

-- And the other one is flipped to cancelled the way ceaute.get_booking_hold_summary
-- and ceaute.expire_provider_booking_holds flip an expired hold the next time
-- anybody looks at it. That is the branch production actually reaches.
update ceaute.booking set status = 'cancelled'
where id = (select id from cancelled_hold);

-- And this one ran out seconds ago, which is not long enough.
update ceaute.booking set expires_at = now() - interval '1 minute'
where id = (select id from just_expired_hold);

set local role service_role;
select set_config('request.jwt.claim.role', 'service_role', true);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.list_discardable_booking_inspiration_images(200)
   where id in (
     select id from ceaute.booking_inspiration_image
     where booking_id = (select id from abandoned_booking)
   )),
  1,
  'An expired hold''s images are offered up for discarding'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.list_discardable_booking_inspiration_images(200)
   where id in (
     select id from ceaute.booking_inspiration_image
     where booking_id = (select id from confirmed_booking)
   )),
  0,
  'A booking that was paid for never offers its images up, whatever became of it'
);

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.list_discardable_booking_inspiration_images(200)
   where booking_id = (select id from cancelled_hold)),
  1,
  'A hold cancelled before it was ever paid for offers its images up too'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.list_discardable_booking_inspiration_images(200)
   where booking_id = (select id from just_expired_hold)),
  0,
  'A hold that has only just run out is left alone, in case a payment is in flight'
);
insert into tap_results (result) select is(
  (select ceaute.discard_booking_inspiration_images(
     array(select id from ceaute.list_discardable_booking_inspiration_images(200))
   )),
  2,
  'Discarding removes exactly the images of bookings nobody paid for'
);

reset role;

insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id in (
     (select id from abandoned_booking), (select id from cancelled_hold)
   )),
  0,
  'An abandoned booking leaves no inspiration images behind'
);
insert into tap_results (result) select is(
  (select count(*)::integer from ceaute.booking_inspiration_image
   where booking_id = (select id from confirmed_booking)),
  1,
  'A successful confirmation preserves its images through the cleanup pass'
);

-- Cleanup is trusted-backend work. A client cannot even reach the function,
-- which is a stronger statement than the check inside it.
set local role authenticated;
select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
insert into tap_results (result) select throws_matching(
  $$select ceaute.discard_booking_inspiration_images(array[]::uuid[])$$,
  'permission denied',
  'A customer cannot invoke the cleanup operation'
);
insert into tap_results (result) select throws_matching(
  $$select * from ceaute.list_discardable_booking_inspiration_images(10)$$,
  'permission denied',
  'A customer cannot list what the cleanup pass would discard'
);

-- Storage objects answer to the same two questions the table does -------------

insert into tap_results (result) select lives_ok(
  format(
    $$insert into storage.objects (bucket_id, name, owner)
      values ('booking-inspiration-images', %L, '1a000000-0000-0000-0000-000000000001')$$,
    (select id from held_booking) || '/object-one.jpg'
  ),
  'The owning customer can put an object under their own booking'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000003', true);
insert into tap_results (result) select throws_matching(
  format(
    $$insert into storage.objects (bucket_id, name, owner)
      values ('booking-inspiration-images', %L, '1a000000-0000-0000-0000-000000000003')$$,
    (select id from held_booking) || '/intruder-object.jpg'
  ),
  'row-level security',
  'A different customer cannot put an object under someone else''s booking'
);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'booking-inspiration-images'),
  0,
  'A different customer cannot read the stored objects either'
);

select set_config('request.jwt.claim.sub', '1a000000-0000-0000-0000-000000000002', true);
insert into tap_results (result) select throws_matching(
  format(
    $$insert into storage.objects (bucket_id, name, owner)
      values ('booking-inspiration-images', %L, '1a000000-0000-0000-0000-000000000002')$$,
    (select id from confirmed_booking) || '/provider-object.jpg'
  ),
  'row-level security',
  'The provider cannot put an object under their customer''s booking'
);

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'booking-inspiration-images'),
  0,
  'An unauthenticated visitor can reach none of the stored objects'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
