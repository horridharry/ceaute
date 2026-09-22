begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(15);

create temp table tap_results (position serial, result text);
grant insert, select on table tap_results to authenticated;
grant usage on sequence tap_results_position_seq to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    'dd000000-0000-0000-0000-000000000001',
    'authenticated', 'authenticated', 'photo-owner@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Photo Owner"}',
    now(), now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    'dd000000-0000-0000-0000-000000000002',
    'authenticated', 'authenticated', 'photo-other@example.test', '', now(),
    '{"provider":"email","providers":["email"]}', '{"full_name":"Other Owner"}',
    now(), now()
  );

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'dd000000-0000-0000-0000-000000000002', true);
select ceaute.create_provider_page_draft('Other Studio', 'photo.other', 'Other Owner');
select set_config('request.jwt.claim.sub', 'dd000000-0000-0000-0000-000000000001', true);
select ceaute.create_provider_page_draft('Photo Studio', 'photo.owner', 'Photo Owner');
reset role;

create temp table pages as
select
  (select id from ceaute.provider_page
   where owner_profile_id = 'dd000000-0000-0000-0000-000000000001') as own_id,
  (select id from ceaute.provider_page
   where owner_profile_id = 'dd000000-0000-0000-0000-000000000002') as other_id;
grant select on table pages to authenticated;

-- Schema and bucket ---------------------------------------------------------------

insert into tap_results (result) select has_column(
  'ceaute', 'provider_page', 'display_photo_path',
  'A provider page can hold a display photo path'
);
insert into tap_results (result) select col_is_null(
  'ceaute', 'provider_page', 'display_photo_path',
  'The display photo is optional'
);
insert into tap_results (result) select is(
  (select public from storage.buckets where id = 'provider-display-photos'),
  false,
  'Display photos are stored in a private bucket'
);
insert into tap_results (result) select is(
  (select file_size_limit from storage.buckets where id = 'provider-display-photos'),
  5242880::bigint,
  'Display photos are limited to 5 MB'
);
insert into tap_results (result) select is(
  (select allowed_mime_types from storage.buckets where id = 'provider-display-photos'),
  array['image/jpeg', 'image/png', 'image/webp'],
  'Display photos accept only JPEG, PNG and WebP'
);

-- The owner sets their own photo path ------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', 'dd000000-0000-0000-0000-000000000001', true);

insert into tap_results (result) select lives_ok(
  format(
    $$update ceaute.provider_page set display_photo_path = %L where id = %L$$,
    (select own_id from pages) || '/11111111-1111-4111-8111-111111111111.jpg',
    (select own_id from pages)
  ),
  'An owner can set a display photo inside their own folder'
);

insert into tap_results (result) select throws_ok(
  format(
    $$update ceaute.provider_page set display_photo_path = %L where id = %L$$,
    (select other_id from pages) || '/11111111-1111-4111-8111-111111111111.jpg',
    (select own_id from pages)
  ),
  '23514',
  null,
  'A display photo path in another page''s folder is rejected'
);

insert into tap_results (result) select throws_ok(
  format(
    $$update ceaute.provider_page set display_photo_path = %L where id = %L$$,
    'photo.gif',
    (select own_id from pages)
  ),
  '23514',
  null,
  'A display photo path that is not an uploaded image path is rejected'
);

-- Another provider's page is out of reach (RLS filters it to zero rows).
update ceaute.provider_page
set display_photo_path = (select other_id from pages) || '/22222222-2222-4222-8222-222222222222.png'
where id = (select other_id from pages);

insert into tap_results (result) select lives_ok(
  format(
    $$update ceaute.provider_page set display_photo_path = null where id = %L$$,
    (select own_id from pages)
  ),
  'An owner can remove their display photo'
);

insert into tap_results (result) select throws_ok(
  format(
    $$update ceaute.provider_page set status = 'published' where id = %L$$,
    (select own_id from pages)
  ),
  '42501',
  null,
  'The new grant does not let owners set platform-managed columns'
);

reset role;

insert into tap_results (result) select is(
  (select display_photo_path from ceaute.provider_page where id = (select other_id from pages)),
  null,
  'An owner cannot set another provider''s display photo'
);

-- Stored objects are visible only to the owning provider --------------------

insert into storage.objects (bucket_id, name, owner)
values (
  'provider-display-photos',
  (select own_id from pages) || '/33333333-3333-4333-8333-333333333333.jpg',
  'dd000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', 'dd000000-0000-0000-0000-000000000001', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'provider-display-photos'),
  1,
  'The owning provider can read their stored display photo'
);

select set_config('request.jwt.claim.sub', 'dd000000-0000-0000-0000-000000000002', true);
insert into tap_results (result) select is(
  (select count(*)::integer from storage.objects
   where bucket_id = 'provider-display-photos'),
  0,
  'Another provider cannot read the stored display photo'
);
reset role;

insert into tap_results (result) select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'provider_display_photos_%_own_provider'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%provider-display-photos%'
     and (coalesce(qual, '') || coalesce(with_check, '')) like '%owner_profile_id%'),
  4,
  'Reading, adding, replacing and removing display photos are all owner-scoped'
);

insert into tap_results (result) select is(
  (select count(*)::integer from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname like 'provider_display_photos%'
     and 'anon' = any(roles)),
  0,
  'Anonymous visitors have no direct access to display photos'
);

select result from tap_results order by position;
select * from finish();
rollback;
