begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(26);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '06000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'add-on-provider-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '06000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'add-on-provider-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

update ceaute.profile
set full_name = 'Add-on Test', phone_e164 = '+447700900666'
where id in (
  '06000000-0000-0000-0000-000000000001',
  '06000000-0000-0000-0000-000000000002'
);

insert into ceaute.provider_page (
  id, owner_profile_id, username, display_name, biography, provider_category, status
)
values
  ('16000000-0000-0000-0000-000000000001', '06000000-0000-0000-0000-000000000001',
   'addon.one', 'Add-on Provider One', 'Fixture', 'Nails', 'draft'),
  ('16000000-0000-0000-0000-000000000002', '06000000-0000-0000-0000-000000000002',
   'addon.two', 'Add-on Provider Two', 'Fixture', 'Nails', 'draft');

-- Provider one owns two active treatments and one archived treatment. Provider
-- two owns the treatment which must never become compatible with provider
-- one's add-ons.
insert into ceaute.treatment (
  id, provider_page_id, name, description, duration_minutes, price_pence, is_active
)
values
  ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001',
   'Manicure', 'Fixture', 60, 5000, true),
  ('26000000-0000-0000-0000-000000000002', '16000000-0000-0000-0000-000000000001',
   'Pedicure', 'Fixture', 60, 6000, true),
  ('26000000-0000-0000-0000-000000000003', '16000000-0000-0000-0000-000000000001',
   'Retired treatment', 'Fixture', 60, 4000, false),
  ('26000000-0000-0000-0000-000000000004', '16000000-0000-0000-0000-000000000002',
   'Other provider treatment', 'Fixture', 60, 7000, true);

-- An add-on which already exists, so the update paths have something to keep.
insert into ceaute.treatment_add_on (
  id, provider_page_id, name, additional_price_pence, additional_duration_minutes
)
values (
  '36000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000001',
  'Existing add-on', 500, 15
);

insert into ceaute.treatment_add_on_compatibility (
  treatment_add_on_id, treatment_id, provider_page_id
)
values (
  '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001',
  '16000000-0000-0000-0000-000000000001'
);

select ok(
  not has_function_privilege(
    'anon',
    'ceaute.create_add_on_with_compatibility(text, bigint, integer, uuid[])',
    'EXECUTE'
  ),
  'Anonymous visitors cannot create add-ons'
);
select ok(
  not has_function_privilege(
    'anon',
    'ceaute.update_add_on_with_compatibility(uuid, text, bigint, integer, uuid[])',
    'EXECUTE'
  ),
  'Anonymous visitors cannot update add-ons'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '06000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

-- Creating an add-on together with its compatible treatments.
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.create_add_on_with_compatibility('Chrome finish', 800, 20, array[%L, %L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002'
  ),
  'An add-on is created with its compatible treatments'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.treatment_add_on_compatibility compatibility
   join ceaute.treatment_add_on add_on on add_on.id = compatibility.treatment_add_on_id
   where add_on.name = 'Chrome finish') = 2,
  'Both requested treatments are compatible with the new add-on'
);
insert into tap_results (result) select is(
  (select additional_price_pence || ':' || additional_duration_minutes
   from ceaute.treatment_add_on where name = 'Chrome finish'),
  '800:20',
  'The new add-on keeps the submitted price and duration'
);

insert into tap_results (result) select lives_ok(
  $$select ceaute.create_add_on_with_compatibility('No treatments yet', 0, 30, array[]::uuid[])$$,
  'An add-on can be created with an empty compatibility list'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.treatment_add_on_compatibility compatibility
   join ceaute.treatment_add_on add_on on add_on.id = compatibility.treatment_add_on_id
   where add_on.name = 'No treatments yet') = 0,
  'An empty compatibility list writes no compatibility rows'
);

insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.create_add_on_with_compatibility('Repeated selection', 300, 0, array[%L, %L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001'
  ),
  'A treatment chosen twice is accepted'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.treatment_add_on_compatibility compatibility
   join ceaute.treatment_add_on add_on on add_on.id = compatibility.treatment_add_on_id
   where add_on.name = 'Repeated selection') = 1,
  'A treatment chosen twice becomes one compatibility row'
);

insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.create_add_on_with_compatibility('Cross provider', 400, 0, array[%L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000004'
  ),
  'Selected treatments are not available',
  'Another provider''s treatment cannot be made compatible'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.create_add_on_with_compatibility('Unknown treatment', 400, 0, array[%L]::uuid[])$$,
    '26000000-0000-0000-0000-0000000000ff'
  ),
  'Selected treatments are not available',
  'An unknown treatment ID is rejected'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.create_add_on_with_compatibility('Archived treatment', 400, 0, array[%L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000003'
  ),
  'Selected treatments are not available',
  'An archived treatment is rejected'
);

-- The whole mutation rolls back, so the provider can correct the selection and
-- retry the same name instead of colliding with a half-created add-on.
insert into tap_results (result) select ok(
  (select count(*) from ceaute.treatment_add_on
   where name in ('Cross provider', 'Unknown treatment', 'Archived treatment')) = 0,
  'A rejected compatibility list leaves no add-on behind'
);
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.create_add_on_with_compatibility('Cross provider', 400, 0, array[%L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000001'
  ),
  'The same add-on name can be retried after a rejected compatibility list'
);

insert into tap_results (result) select throws_matching(
  $$select ceaute.create_add_on_with_compatibility('existing ADD-ON', 100, 0, array[]::uuid[])$$,
  'treatment_add_on_provider_name_unique',
  'A duplicate add-on name is still rejected'
);

-- Updating an add-on together with its compatible treatments.
insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.update_add_on_with_compatibility(%L, 'Renamed add-on', 900, 45, array[%L]::uuid[])$$,
    '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000002'
  ),
  'An add-on and its compatibility are updated together'
);
insert into tap_results (result) select is(
  (select name || ':' || additional_price_pence || ':' || additional_duration_minutes
   from ceaute.treatment_add_on where id = '36000000-0000-0000-0000-000000000001'),
  'Renamed add-on:900:45',
  'The updated add-on keeps the submitted values'
);
insert into tap_results (result) select is(
  (select string_agg(treatment_id::text, ',')
   from ceaute.treatment_add_on_compatibility
   where treatment_add_on_id = '36000000-0000-0000-0000-000000000001'),
  '26000000-0000-0000-0000-000000000002',
  'The previous compatibility is replaced by the new list'
);

insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.update_add_on_with_compatibility(%L, 'Borrowed treatment', 100, 5, array[%L]::uuid[])$$,
    '36000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000004'
  ),
  'Selected treatments are not available',
  'An update cannot borrow another provider''s treatment'
);
insert into tap_results (result) select is(
  (select name || ':' || additional_price_pence || ':' || additional_duration_minutes
   from ceaute.treatment_add_on where id = '36000000-0000-0000-0000-000000000001'),
  'Renamed add-on:900:45',
  'A rejected update leaves the add-on unchanged'
);
insert into tap_results (result) select is(
  (select string_agg(treatment_id::text, ',')
   from ceaute.treatment_add_on_compatibility
   where treatment_add_on_id = '36000000-0000-0000-0000-000000000001'),
  '26000000-0000-0000-0000-000000000002',
  'A rejected update leaves the previous compatibility unchanged'
);

insert into tap_results (result) select lives_ok(
  format(
    $$select ceaute.update_add_on_with_compatibility(%L, 'Renamed add-on', 900, 45, array[]::uuid[])$$,
    '36000000-0000-0000-0000-000000000001'
  ),
  'All compatibility can be removed on purpose'
);
insert into tap_results (result) select ok(
  (select count(*) from ceaute.treatment_add_on_compatibility
   where treatment_add_on_id = '36000000-0000-0000-0000-000000000001') = 0,
  'An empty list removes every compatibility row'
);

-- Provider two must reach neither provider one's add-on nor their treatments.
select set_config('request.jwt.claim.sub', '06000000-0000-0000-0000-000000000002', true);

insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.update_add_on_with_compatibility(%L, 'Stolen add-on', 100, 0, array[]::uuid[])$$,
    '36000000-0000-0000-0000-000000000001'
  ),
  'Add-on not found',
  'Another provider cannot update an add-on by ID'
);
insert into tap_results (result) select throws_matching(
  format(
    $$select ceaute.create_add_on_with_compatibility('Borrowed treatment', 100, 0, array[%L]::uuid[])$$,
    '26000000-0000-0000-0000-000000000001'
  ),
  'Selected treatments are not available',
  'A provider cannot attach their own add-on to another provider''s treatment'
);

select set_config('request.jwt.claim.sub', '06000000-0000-0000-0000-000000000001', true);

insert into tap_results (result) select is(
  (select name from ceaute.treatment_add_on where id = '36000000-0000-0000-0000-000000000001'),
  'Renamed add-on',
  'A rejected cross-provider update changed nothing'
);

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
