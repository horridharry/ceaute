begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(6);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  'fa000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'fresh-provider-bootstrap@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Fresh Provider"}',
  now(),
  now()
);

select ok(
  exists (
    select 1 from ceaute.profile
    where id = 'fa000000-0000-0000-0000-000000000001'
  ),
  'A newly created auth user receives a profile'
);

-- Recreate the hosted failure: the auth identity exists but its profile does
-- not. Provider onboarding should repair only that signed-in identity.
delete from ceaute.profile
where id = 'fa000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  'fa000000-0000-0000-0000-000000000001',
  true
);
select set_config('request.jwt.claim.role', 'authenticated', true);

insert into tap_results (result) select lives_ok(
  $$select ceaute.create_provider_page_draft(
    'Fresh Provider Studio', 'fresh.provider', 'New provider'
  )$$,
  'Provider onboarding repairs a missing profile and creates the draft'
);

insert into tap_results (result) select ok(
  exists (
    select 1 from ceaute.profile
    where id = 'fa000000-0000-0000-0000-000000000001'
  ),
  'The signed-in account profile is restored'
);

insert into tap_results (result) select is(
  (
    select count(*)::integer from ceaute.provider_page
    where owner_profile_id = 'fa000000-0000-0000-0000-000000000001'
  ),
  1,
  'The fresh account owns one provider draft'
);

insert into tap_results (result) select is(
  (
    select count(*)::integer from ceaute.provider_location
    where provider_page_id in (
      select id from ceaute.provider_page
      where owner_profile_id = 'fa000000-0000-0000-0000-000000000001'
    )
  ),
  0,
  'A provider draft intentionally starts with no location'
);

insert into ceaute.provider_location (
  provider_page_id,
  public_area,
  address_line_1,
  city,
  postcode,
  country_code,
  access_instructions
)
select
  id,
  'Fresh Area',
  '1 Fresh Road',
  'London',
  'E1 1AA',
  'GB',
  null
from ceaute.provider_page
where owner_profile_id = 'fa000000-0000-0000-0000-000000000001';

insert into tap_results (result) select ok(
  (
    select is_primary from ceaute.provider_location
    where provider_page_id in (
      select id from ceaute.provider_page
      where owner_profile_id = 'fa000000-0000-0000-0000-000000000001'
    )
  ),
  'The authenticated provider can create a first primary location'
);

reset role;

select result from tap_results;
select * from finish();
rollback;
