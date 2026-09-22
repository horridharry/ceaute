-- Soft deletion of add-ons and treatment groups, and the published-portfolio
-- guard (202609220002, 202609220003).
begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, ceaute;

select plan(49);

create temp table tap_results (result text);
grant insert, select on table tap_results to authenticated;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('00000000-0000-0000-0000-000000000000', '09000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'soft-delete-one@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '09000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'soft-delete-two@example.test', '', now(), '{"provider":"email","providers":["email"]}', '{}', now(), now());

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, biography, provider_category, status)
values
  ('19000000-0000-0000-0000-000000000001', '09000000-0000-0000-0000-000000000001', 'soft.one', 'Soft One', 'Fixture', 'Nails', 'draft'),
  ('19000000-0000-0000-0000-000000000002', '09000000-0000-0000-0000-000000000002', 'soft.two', 'Soft Two', 'Fixture', 'Nails', 'draft');

insert into ceaute.treatment_group (id, provider_page_id, name)
values
  ('29000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'Manicures'),
  ('29000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001', 'Empty group'),
  ('29000000-0000-0000-0000-000000000003', '19000000-0000-0000-0000-000000000001', 'Legacy archived');

insert into ceaute.treatment (id, provider_page_id, name, description, duration_minutes, price_pence, is_active, treatment_group_id)
values
  ('39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'Gel manicure', 'Fixture', 60, 3500, true, '29000000-0000-0000-0000-000000000001'),
  ('39000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001', 'Old treatment', 'Fixture', 60, 3000, false, '29000000-0000-0000-0000-000000000003');

-- The legacy group is archived with an archived treatment still inside it:
-- data the application could produce before this migration.
update ceaute.treatment_group set is_active = false where id = '29000000-0000-0000-0000-000000000003';

insert into ceaute.treatment_add_on (id, provider_page_id, name, additional_price_pence, additional_duration_minutes)
values
  ('49000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', 'Gel removal', 1000, 20),
  ('49000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001', 'Chrome finish', 600, 10);

insert into ceaute.treatment_add_on_compatibility (treatment_add_on_id, treatment_id, provider_page_id)
values
  ('49000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001'),
  -- Chrome finish is linked to an active and to an archived treatment (D6).
  ('49000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001'),
  ('49000000-0000-0000-0000-000000000002', '39000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001');

-- Permissions -------------------------------------------------------------------

select ok(not has_table_privilege('authenticated', 'ceaute.treatment_add_on', 'DELETE'), 'Providers have no physical DELETE on add-ons');
select ok(not has_table_privilege('authenticated', 'ceaute.treatment_group', 'DELETE'), 'Providers have no physical DELETE on groups');
select ok(not has_column_privilege('authenticated', 'ceaute.treatment_add_on', 'is_active', 'UPDATE'), 'Providers cannot write add-on is_active directly');
select ok(not has_column_privilege('authenticated', 'ceaute.treatment_add_on', 'deleted_at', 'UPDATE'), 'Providers cannot write add-on deleted_at directly');
select ok(not has_column_privilege('authenticated', 'ceaute.treatment_group', 'is_active', 'UPDATE'), 'Providers cannot write group is_active directly');
select ok(not has_column_privilege('authenticated', 'ceaute.treatment_group', 'deleted_at', 'UPDATE'), 'Providers cannot write group deleted_at directly');
select ok(has_column_privilege('authenticated', 'ceaute.treatment_add_on', 'name', 'UPDATE'), 'Providers can still rename add-ons');
select ok(not has_function_privilege('anon', 'ceaute.transition_treatment_add_on(uuid, text)', 'EXECUTE'), 'Anonymous visitors cannot transition add-ons');
select ok(not has_function_privilege('anon', 'ceaute.transition_treatment_group(uuid, text)', 'EXECUTE'), 'Anonymous visitors cannot transition groups');

-- Provider one ------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claim.sub', '09000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select throws_ok($$ select ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'delete') $$, 'CE010', 'Archive this add-on before deleting it.', 'An active add-on cannot be deleted');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'archive'), 'archived', 'Active add-on archives');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'archive'), 'unchanged', 'Archiving twice is a no-op');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'restore'), 'restored', 'Archived add-on restores');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'restore'), 'unchanged', 'Restoring twice is a no-op');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'archive'), 'archived', 'Archive again before delete');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'delete'), 'deleted', 'Archived add-on deletes');
select is(ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'delete'), 'unchanged', 'Deleting twice is a no-op');
select throws_ok($$ select ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000001', 'restore') $$, 'CE002', 'Add-on not found.', 'A deleted add-on cannot be restored');
select is((select count(*)::int from ceaute.treatment_add_on where id = '49000000-0000-0000-0000-000000000001'), 0, 'Deleted add-on is invisible to its owner');
select is((select count(*)::int from ceaute.treatment_add_on_compatibility where treatment_add_on_id = '49000000-0000-0000-0000-000000000001'), 1, 'Its treatment link is kept, not physically deleted');
select is((select count(*)::int from ceaute.treatment where id = '39000000-0000-0000-0000-000000000001'), 1, 'Linked treatment still exists');
-- D2: the deleted add-on's link cannot be removed by a direct request.
select lives_ok($$ delete from ceaute.treatment_add_on_compatibility where treatment_add_on_id = '49000000-0000-0000-0000-000000000001' $$, 'A direct delete of a deleted add-on''s link runs');
reset role;
select is((select count(*)::int from ceaute.treatment_add_on_compatibility where treatment_add_on_id = '49000000-0000-0000-0000-000000000001'), 1, 'D2: the deleted add-on''s link is still stored');
set local role authenticated;
select set_config('request.jwt.claim.sub', '09000000-0000-0000-0000-000000000001', true);
-- D6: saving an add-on keeps its links to archived treatments.
select lives_ok($$ select ceaute.update_add_on_with_compatibility('49000000-0000-0000-0000-000000000002', 'Chrome finish', 600, 10, array['39000000-0000-0000-0000-000000000001']::uuid[]) $$, 'D6: saving with only the active treatment ticked works');
select is((select string_agg(treatment_id::text, ',' order by treatment_id) from ceaute.treatment_add_on_compatibility where treatment_add_on_id = '49000000-0000-0000-0000-000000000002'), '39000000-0000-0000-0000-000000000001,39000000-0000-0000-0000-000000000002', 'D6: the link to the archived treatment is kept');
select lives_ok($$ select ceaute.update_add_on_with_compatibility('49000000-0000-0000-0000-000000000002', 'Chrome finish', 600, 10, '{}'::uuid[]) $$, 'D6: clearing every active treatment works');
select is((select string_agg(treatment_id::text, ',') from ceaute.treatment_add_on_compatibility where treatment_add_on_id = '49000000-0000-0000-0000-000000000002'), '39000000-0000-0000-0000-000000000002', 'D6: only active links are removed; the archived link stays');
select throws_ok($$ select ceaute.update_add_on_with_compatibility('49000000-0000-0000-0000-000000000002', 'Chrome finish', 600, 10, array['39000000-0000-0000-0000-000000000002']::uuid[]) $$, 'CE003', 'Selected treatments are not available.', 'D6: a new link to an archived treatment is still refused');
select throws_ok($$ update ceaute.treatment_add_on set is_active = false where id = '49000000-0000-0000-0000-000000000002' $$, '42501', null, 'Direct is_active writes are refused');
select throws_ok($$ select ceaute.update_add_on_with_compatibility('49000000-0000-0000-0000-000000000001', 'Gel removal', 1000, 20, '{}'::uuid[]) $$, 'CE002', 'Add-on not found.', 'A deleted add-on cannot be edited');
select throws_ok($$ insert into ceaute.treatment_add_on_compatibility (treatment_add_on_id, treatment_id, provider_page_id) values ('49000000-0000-0000-0000-000000000001', '39000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001') $$, '42501', null, 'A deleted add-on cannot be linked again');
select lives_ok($$ select ceaute.create_add_on_with_compatibility('Gel removal', 1200, 20, '{}'::uuid[]) $$, 'A deleted add-on name can be reused');
select throws_ok($$ select ceaute.create_add_on_with_compatibility('Chrome finish', 600, 10, '{}'::uuid[]) $$, '23505', null, 'An active name still cannot be reused');

-- Groups
select throws_ok($$ select ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000001', 'archive') $$, 'CE011', null, 'A group with an active treatment cannot be archived');
select throws_ok($$ select ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000003', 'delete') $$, 'CE011', null, 'A group with an archived treatment cannot be deleted');
select throws_ok($$ select ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000002', 'delete') $$, 'CE010', 'Archive this group before deleting it.', 'An active group cannot be deleted');
select is(ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000002', 'archive'), 'archived', 'An empty group archives');
select throws_ok($$ update ceaute.treatment set treatment_group_id = '29000000-0000-0000-0000-000000000002' where id = '39000000-0000-0000-0000-000000000001' $$, 'CE014', null, 'A treatment cannot move into an archived group');
select is(ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000002', 'delete'), 'deleted', 'An empty archived group deletes');
select is((select count(*)::int from ceaute.treatment_group where id = '29000000-0000-0000-0000-000000000002'), 0, 'Deleted group is invisible to its owner');
select lives_ok($$ insert into ceaute.treatment_group (provider_page_id, name) values ('19000000-0000-0000-0000-000000000001', 'Empty group') $$, 'A deleted group name can be reused');
select lives_ok($$ update ceaute.treatment set description = 'Edited' where id = '39000000-0000-0000-0000-000000000002' $$, 'An archived treatment in a legacy archived group can still be edited');
select is((select count(*)::int from ceaute.treatment_group where id = '29000000-0000-0000-0000-000000000003'), 1, 'D7: an archived (not deleted) group stays visible to its owner');

-- Provider two cannot act on provider one's records
select set_config('request.jwt.claim.sub', '09000000-0000-0000-0000-000000000002', true);
select throws_ok($$ select ceaute.transition_treatment_add_on('49000000-0000-0000-0000-000000000002', 'archive') $$, 'CE002', 'Add-on not found.', 'Another provider cannot archive the add-on');
select throws_ok($$ select ceaute.transition_treatment_group('29000000-0000-0000-0000-000000000001', 'archive') $$, 'CE012', 'Treatment group not found.', 'Another provider cannot archive the group');

reset role;

-- Portfolio guard (second proposed migration) ---------------------------------------

insert into ceaute.portfolio_image (id, provider_page_id, storage_path, is_visible)
values
  ('59000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001/a.jpg', true),
  ('59000000-0000-0000-0000-000000000002', '19000000-0000-0000-0000-000000000001', '19000000-0000-0000-0000-000000000001/b.jpg', true);

-- Published by the platform role, bypassing the requirements check that is
-- not under test here.
update ceaute.provider_page set status = 'published', published_at = now() where id = '19000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claim.sub', '09000000-0000-0000-0000-000000000001', true);

select lives_ok($$ delete from ceaute.portfolio_image where id = '59000000-0000-0000-0000-000000000001' $$, 'A published page can delete a photo while another stays visible');
select throws_ok($$ delete from ceaute.portfolio_image where id = '59000000-0000-0000-0000-000000000002' $$, 'CE013', null, 'A published page cannot delete its last visible photo');
select throws_ok($$ update ceaute.portfolio_image set is_visible = false where id = '59000000-0000-0000-0000-000000000002' $$, 'CE013', null, 'A published page cannot hide its last visible photo');

reset role;
update ceaute.provider_page set status = 'draft' where id = '19000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '09000000-0000-0000-0000-000000000001', true);

select lives_ok($$ delete from ceaute.portfolio_image where id = '59000000-0000-0000-0000-000000000002' $$, 'A draft page can delete its last photo');

reset role;
insert into tap_results (result) select * from finish();
select result from tap_results;
rollback;
