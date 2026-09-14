-- Saving an add-on writes two things: the add-on row and the set of treatments
-- it may be booked with. Server actions previously did that as an insert or
-- update followed by a separate delete-and-insert of the compatibility rows, so
-- a failure in between could leave a new add-on with no compatibility, strip an
-- existing add-on's compatibility, or make a retry collide with the add-on it
-- had already created.
--
-- These functions make each save one statement, and therefore one transaction.
-- They run with the caller's rights, so row-level security still applies; the
-- explicit ownership checks exist to fail with a usable reason rather than
-- silently writing nothing.
--
-- Ceaute error codes raised here:
--   CE001  the account has no provider page
--   CE002  the add-on does not belong to that provider page
--   CE003  a selected treatment is not an active treatment of that page

create or replace function ceaute.replace_add_on_treatment_compatibility(
  target_provider_page_id uuid,
  target_add_on_id uuid,
  compatible_treatment_ids uuid[]
)
returns void
language plpgsql
set search_path = ceaute, public
as $$
declare
  unique_treatment_ids uuid[];
  owned_treatment_count integer;
begin
  -- The add-on has to be this provider page's own, whether it was just created
  -- by the caller below or is being edited.
  if not exists (
    select 1
    from ceaute.treatment_add_on
    where treatment_add_on.id = target_add_on_id
      and treatment_add_on.provider_page_id = target_provider_page_id
  ) then
    raise exception 'Add-on not found.' using errcode = 'CE002';
  end if;

  -- Duplicates in the submitted list mean one checkbox, not two rows, and a
  -- missing list means "compatible with nothing".
  select coalesce(array_agg(distinct candidate_id), '{}'::uuid[])
  into unique_treatment_ids
  from unnest(coalesce(compatible_treatment_ids, '{}'::uuid[])) as candidate_id
  where candidate_id is not null;

  delete from ceaute.treatment_add_on_compatibility
  where provider_page_id = target_provider_page_id
    and treatment_add_on_id = target_add_on_id;

  if cardinality(unique_treatment_ids) = 0 then
    return;
  end if;

  -- Every treatment must be an active treatment of the same provider page. The
  -- composite foreign key would reject another provider's treatment anyway;
  -- counting here also rejects unknown and archived ones with one message.
  select count(*)
  into owned_treatment_count
  from ceaute.treatment
  where treatment.provider_page_id = target_provider_page_id
    and treatment.is_active
    and treatment.id = any(unique_treatment_ids);

  if owned_treatment_count <> cardinality(unique_treatment_ids) then
    raise exception 'Selected treatments are not available.'
      using errcode = 'CE003';
  end if;

  insert into ceaute.treatment_add_on_compatibility (
    treatment_add_on_id,
    treatment_id,
    provider_page_id
  )
  select target_add_on_id, accepted_id, target_provider_page_id
  from unnest(unique_treatment_ids) as accepted_id;
end;
$$;

create or replace function ceaute.create_add_on_with_compatibility(
  add_on_name text,
  additional_price_pence bigint,
  additional_duration_minutes integer,
  compatible_treatment_ids uuid[]
)
returns uuid
language plpgsql
set search_path = ceaute, public
as $$
declare
  owned_provider_page_id uuid;
  created_add_on_id uuid;
begin
  select provider_page.id
  into owned_provider_page_id
  from ceaute.provider_page
  where provider_page.owner_profile_id = (select auth.uid());

  if owned_provider_page_id is null then
    raise exception 'Provider page not found.' using errcode = 'CE001';
  end if;

  insert into ceaute.treatment_add_on (
    provider_page_id,
    name,
    additional_price_pence,
    additional_duration_minutes
  )
  values (
    owned_provider_page_id,
    add_on_name,
    additional_price_pence,
    additional_duration_minutes
  )
  returning treatment_add_on.id into created_add_on_id;

  perform ceaute.replace_add_on_treatment_compatibility(
    owned_provider_page_id,
    created_add_on_id,
    compatible_treatment_ids
  );

  return created_add_on_id;
end;
$$;

create or replace function ceaute.update_add_on_with_compatibility(
  target_add_on_id uuid,
  add_on_name text,
  additional_price_pence bigint,
  additional_duration_minutes integer,
  compatible_treatment_ids uuid[]
)
returns void
language plpgsql
set search_path = ceaute, public
as $$
declare
  owned_provider_page_id uuid;
begin
  select provider_page.id
  into owned_provider_page_id
  from ceaute.provider_page
  where provider_page.owner_profile_id = (select auth.uid());

  if owned_provider_page_id is null then
    raise exception 'Provider page not found.' using errcode = 'CE001';
  end if;

  -- Archiving and restoring stay separate operations, so is_active is left as
  -- the provider last set it.
  update ceaute.treatment_add_on
  set name = add_on_name,
      additional_price_pence = update_add_on_with_compatibility.additional_price_pence,
      additional_duration_minutes =
        update_add_on_with_compatibility.additional_duration_minutes
  where treatment_add_on.id = target_add_on_id
    and treatment_add_on.provider_page_id = owned_provider_page_id;

  if not found then
    raise exception 'Add-on not found.' using errcode = 'CE002';
  end if;

  perform ceaute.replace_add_on_treatment_compatibility(
    owned_provider_page_id,
    target_add_on_id,
    compatible_treatment_ids
  );
end;
$$;

comment on function ceaute.replace_add_on_treatment_compatibility(uuid, uuid, uuid[]) is
  'Replaces one add-on''s compatible treatments. Called inside the add-on save so both changes share a transaction.';

comment on function ceaute.create_add_on_with_compatibility(text, bigint, integer, uuid[]) is
  'Creates an add-on and its treatment compatibility together; neither survives a failure in the other.';

comment on function ceaute.update_add_on_with_compatibility(uuid, text, bigint, integer, uuid[]) is
  'Updates an add-on and replaces its treatment compatibility together; a rejected treatment leaves the add-on unchanged.';

revoke all on function ceaute.replace_add_on_treatment_compatibility(uuid, uuid, uuid[])
from public, anon, authenticated;

revoke all on function ceaute.create_add_on_with_compatibility(text, bigint, integer, uuid[])
from public, anon, authenticated;

revoke all on function ceaute.update_add_on_with_compatibility(uuid, text, bigint, integer, uuid[])
from public, anon, authenticated;

-- These run with the caller's rights, so the signed-in provider needs execute
-- on each. Compatibility replacement is granted because the create and update
-- functions call it as that same provider, not to invite direct use.
grant execute on function ceaute.replace_add_on_treatment_compatibility(uuid, uuid, uuid[])
to authenticated;

grant execute on function ceaute.create_add_on_with_compatibility(text, bigint, integer, uuid[])
to authenticated;

grant execute on function ceaute.update_add_on_with_compatibility(uuid, text, bigint, integer, uuid[])
to authenticated;
