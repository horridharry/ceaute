-- Soft deletion for add-ons and treatment groups (provider dashboard redesign).
-- Approved decisions: soft delete only after archiving; D1 names of deleted
-- records can be reused; D2 a deleted add-on keeps its treatment links; D6
-- saving an add-on keeps its links to archived treatments.
--
-- Add-ons and treatment groups gain a terminal Deleted state beside the
-- existing Active and Archived ones. Nothing is ever physically deleted and
-- no DELETE privilege is granted.
--
--   State     is_active   deleted_at
--   Active    true        null
--   Archived  false       null
--   Deleted   false       set        (terminal; invisible to the provider)
--
-- Allowed transitions, enforced only by the functions below:
--   Active   -> Archived   (groups: only while no treatment references it)
--   Archived -> Active
--   Archived -> Deleted    (groups: only while no treatment references it)
-- Everything else is rejected. Repeating a transition that has already
-- happened is a no-op that reports 'unchanged', so a double-submitted form is
-- harmless.
--
-- Why nothing else needs to change for customers: every public, storefront
-- and booking-hold read of these tables already filters is_active = true, and
-- the new check constraints make a deleted row always inactive. Deleted rows
-- are additionally hidden from the provider by row-level security, and the
-- provider can no longer write is_active or deleted_at directly.
--
-- Ceaute error codes added here (CE001-CE003 already exist):
--   CE010  requested transition is not allowed from the current state
--   CE011  treatment group is still referenced by treatments
--   CE012  treatment group not found for this provider
--   CE014  treatment cannot be filed under an archived or deleted group
-- (CE013 is raised by 202609220003_keep_published_pages_publishable_portfolio.)

-- 1. State --------------------------------------------------------------------

alter table ceaute.treatment_add_on
  add column deleted_at timestamptz;

alter table ceaute.treatment_group
  add column deleted_at timestamptz;

-- Existing rows all have deleted_at null, so both constraints validate
-- without a backfill.
alter table ceaute.treatment_add_on
  add constraint treatment_add_on_deleted_is_inactive
  check (deleted_at is null or is_active = false);

alter table ceaute.treatment_group
  add constraint treatment_group_deleted_is_inactive
  check (deleted_at is null or is_active = false);

comment on column ceaute.treatment_add_on.deleted_at is
  'Set once when the provider deletes an archived add-on. Deleted add-ons are terminal and hidden from the provider; bookings keep their own snapshot.';

comment on column ceaute.treatment_group.deleted_at is
  'Set once when the provider deletes an archived, unused treatment group. Deleted groups are terminal and hidden from the provider.';

-- 2. Names ---------------------------------------------------------------------
-- A deleted record is gone as far as the provider can tell, so its name is
-- free to use again. Archived records keep their name reserved, because the
-- provider can still see and restore them.

drop index if exists ceaute.treatment_add_on_provider_name_unique;

create unique index treatment_add_on_provider_name_unique
  on ceaute.treatment_add_on (provider_page_id, lower(btrim(name)))
  where deleted_at is null;

drop index if exists ceaute.treatment_group_provider_name_unique;

create unique index treatment_group_provider_name_unique
  on ceaute.treatment_group (provider_page_id, lower(btrim(name)))
  where deleted_at is null;

-- Implied by the index above since 202609110003.
drop index if exists ceaute.treatment_group_active_name_unique;

-- 3. What the provider may write directly ----------------------------------------
-- is_active and deleted_at change only through the transition functions.
-- Mirrors the provider_location pattern in 202609200001.

revoke insert, update on table ceaute.treatment_add_on from authenticated;

grant insert (
  provider_page_id,
  name,
  additional_price_pence,
  additional_duration_minutes
) on table ceaute.treatment_add_on to authenticated;

grant update (
  name,
  additional_price_pence,
  additional_duration_minutes
) on table ceaute.treatment_add_on to authenticated;

revoke insert, update on table ceaute.treatment_group from authenticated;

grant insert (provider_page_id, name) on table ceaute.treatment_group to authenticated;

grant update (name) on table ceaute.treatment_group to authenticated;

-- 4. Row-level security --------------------------------------------------------
-- Deleted rows are invisible and unwritable for the provider. The transition
-- functions are security definer, so they still see them.

alter policy treatment_add_on_select_own_provider
on ceaute.treatment_add_on
using (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

alter policy treatment_add_on_insert_own_provider
on ceaute.treatment_add_on
with check (
  deleted_at is null
  and is_active = true
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

alter policy treatment_add_on_update_own_provider
on ceaute.treatment_add_on
using (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

alter policy treatment_group_select_own_provider
on ceaute.treatment_group
using (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

alter policy treatment_group_insert_own_provider
on ceaute.treatment_group
with check (
  deleted_at is null
  and is_active = true
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

alter policy treatment_group_update_own_provider
on ceaute.treatment_group
using (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  deleted_at is null
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

-- A provider cannot link a treatment to a deleted add-on. The subquery runs
-- under the caller's row-level security, which already hides deleted add-ons.
-- Existing links of a deleted add-on are kept (D2) and are ignored by every
-- reader because the add-on is inactive.
alter policy treatment_add_on_compatibility_insert_own_provider
on ceaute.treatment_add_on_compatibility
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
  and exists (
    select 1
    from ceaute.treatment_add_on
    where treatment_add_on.id = treatment_add_on_compatibility.treatment_add_on_id
      and treatment_add_on.deleted_at is null
  )
);

alter policy treatment_add_on_compatibility_update_own_provider
on ceaute.treatment_add_on_compatibility
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
  and exists (
    select 1
    from ceaute.treatment_add_on
    where treatment_add_on.id = treatment_add_on_compatibility.treatment_add_on_id
      and treatment_add_on.deleted_at is null
  )
);

-- D2: a deleted add-on's treatment links are kept internally. The provider
-- keeps DELETE on the link table (the add-on save replaces links through it),
-- but only for links of add-ons they can still see, so a deleted add-on's
-- links can no longer be removed by a direct request.
alter policy treatment_add_on_compatibility_delete_own_provider
on ceaute.treatment_add_on_compatibility
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
  and exists (
    select 1
    from ceaute.treatment_add_on
    where treatment_add_on.id = treatment_add_on_compatibility.treatment_add_on_id
      and treatment_add_on.deleted_at is null
  )
);

-- 5. Add-on transitions ----------------------------------------------------------

create or replace function ceaute.transition_treatment_add_on(
  target_add_on_id uuid,
  requested_transition text
)
returns text
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target ceaute.treatment_add_on%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if requested_transition not in ('archive', 'restore', 'delete') then
    raise exception 'Unknown transition.' using errcode = 'CE010';
  end if;

  -- Lock the row so two tabs, or a double submit, apply one transition after
  -- the other rather than both reading the same starting state.
  select treatment_add_on.*
  into target
  from ceaute.treatment_add_on
  join ceaute.provider_page
    on provider_page.id = treatment_add_on.provider_page_id
  where treatment_add_on.id = target_add_on_id
    and provider_page.owner_profile_id = current_profile_id
  for update of treatment_add_on;

  if not found then
    raise exception 'Add-on not found.' using errcode = 'CE002';
  end if;

  if target.deleted_at is not null then
    -- Deleted is terminal. Repeating the delete is harmless; anything else is
    -- treating a record the provider can no longer see as if it existed.
    if requested_transition = 'delete' then
      return 'unchanged';
    end if;
    raise exception 'Add-on not found.' using errcode = 'CE002';
  end if;

  if requested_transition = 'archive' then
    if not target.is_active then
      return 'unchanged';
    end if;
    update ceaute.treatment_add_on
    set is_active = false
    where id = target.id;
    return 'archived';
  end if;

  if requested_transition = 'restore' then
    if target.is_active then
      return 'unchanged';
    end if;
    update ceaute.treatment_add_on
    set is_active = true
    where id = target.id;
    return 'restored';
  end if;

  -- delete
  if target.is_active then
    raise exception 'Archive this add-on before deleting it.' using errcode = 'CE010';
  end if;

  update ceaute.treatment_add_on
  set deleted_at = now()
  where id = target.id;
  return 'deleted';
end;
$$;

comment on function ceaute.transition_treatment_add_on(uuid, text) is
  'The only way a provider archives, restores or deletes an add-on. Returns archived, restored, deleted or unchanged.';

revoke all on function ceaute.transition_treatment_add_on(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.transition_treatment_add_on(uuid, text)
to authenticated;

-- 6. Treatment group transitions --------------------------------------------------

create or replace function ceaute.transition_treatment_group(
  target_group_id uuid,
  requested_transition text
)
returns text
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target ceaute.treatment_group%rowtype;
  referencing_treatments integer;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if requested_transition not in ('archive', 'restore', 'delete') then
    raise exception 'Unknown transition.' using errcode = 'CE010';
  end if;

  -- Locking the group serialises this with ceaute.ensure_treatment_group_assignable,
  -- which share-locks the same row before a treatment is filed under it. A
  -- treatment cannot slip into the group between the count below and the
  -- update.
  select treatment_group.*
  into target
  from ceaute.treatment_group
  join ceaute.provider_page
    on provider_page.id = treatment_group.provider_page_id
  where treatment_group.id = target_group_id
    and provider_page.owner_profile_id = current_profile_id
  for update of treatment_group;

  if not found then
    raise exception 'Treatment group not found.' using errcode = 'CE012';
  end if;

  if target.deleted_at is not null then
    if requested_transition = 'delete' then
      return 'unchanged';
    end if;
    raise exception 'Treatment group not found.' using errcode = 'CE012';
  end if;

  if requested_transition = 'restore' then
    if target.is_active then
      return 'unchanged';
    end if;
    update ceaute.treatment_group
    set is_active = true
    where id = target.id;
    return 'restored';
  end if;

  if requested_transition = 'archive' and not target.is_active then
    return 'unchanged';
  end if;

  if requested_transition = 'delete' and target.is_active then
    raise exception 'Archive this group before deleting it.' using errcode = 'CE010';
  end if;

  -- Archive and delete both require that no treatment, active or archived,
  -- still points at the group. This was an application-only message before;
  -- it is now enforced here.
  select count(*)
  into referencing_treatments
  from ceaute.treatment
  where treatment.provider_page_id = target.provider_page_id
    and treatment.treatment_group_id = target.id;

  if referencing_treatments > 0 then
    raise exception 'This group still contains % treatment(s).', referencing_treatments
      using errcode = 'CE011';
  end if;

  if requested_transition = 'archive' then
    update ceaute.treatment_group
    set is_active = false
    where id = target.id;
    return 'archived';
  end if;

  update ceaute.treatment_group
  set deleted_at = now()
  where id = target.id;
  return 'deleted';
end;
$$;

comment on function ceaute.transition_treatment_group(uuid, text) is
  'The only way a provider archives, restores or deletes a treatment group. Archive and delete are refused while any treatment references the group.';

revoke all on function ceaute.transition_treatment_group(uuid, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.transition_treatment_group(uuid, text)
to authenticated;

-- 7. Treatments may only be filed under an active group ---------------------------
-- Previously checked only by the treatment server action. Enforced here so a
-- treatment can never reference a group that is being, or has been, archived
-- or deleted. Only a change of group is checked: an archived treatment left in
-- a group that was archived before this migration keeps working.

create or replace function ceaute.ensure_treatment_group_assignable()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if new.treatment_group_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and new.treatment_group_id is not distinct from old.treatment_group_id then
    return new;
  end if;

  perform 1
  from ceaute.treatment_group
  where treatment_group.id = new.treatment_group_id
    and treatment_group.provider_page_id = new.provider_page_id
    and treatment_group.is_active = true
    and treatment_group.deleted_at is null
  for share;

  if not found then
    raise exception 'Choose one of your active treatment groups.' using errcode = 'CE014';
  end if;

  return new;
end;
$$;

revoke all on function ceaute.ensure_treatment_group_assignable()
from public, anon, authenticated, service_role;

create trigger treatment_group_must_be_assignable
before insert or update of treatment_group_id on ceaute.treatment
for each row execute function ceaute.ensure_treatment_group_assignable();

-- 8. D6: saving an add-on keeps its links to archived treatments ----------------
-- The add-on form lists only active treatments, so a link to an archived
-- treatment was never submitted and the replace below used to delete it.
-- Now only links to active treatments are replaced; links to archived
-- treatments are left exactly as they are, and come back into use if the
-- treatment is restored. Submitting an archived treatment is still refused
-- (CE003), so a new link to an archived treatment cannot be created.
-- Same signature, so existing grants and callers are unchanged.

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
  -- Runs with the caller's rights: row-level security hides deleted add-ons,
  -- so a deleted add-on is "not found" here and its links cannot change.
  if not exists (
    select 1
    from ceaute.treatment_add_on
    where treatment_add_on.id = target_add_on_id
      and treatment_add_on.provider_page_id = target_provider_page_id
  ) then
    raise exception 'Add-on not found.' using errcode = 'CE002';
  end if;

  select coalesce(array_agg(distinct candidate_id), '{}'::uuid[])
  into unique_treatment_ids
  from unnest(coalesce(compatible_treatment_ids, '{}'::uuid[])) as candidate_id
  where candidate_id is not null;

  delete from ceaute.treatment_add_on_compatibility
  where treatment_add_on_compatibility.provider_page_id = target_provider_page_id
    and treatment_add_on_compatibility.treatment_add_on_id = target_add_on_id
    and treatment_add_on_compatibility.treatment_id in (
      select treatment.id
      from ceaute.treatment
      where treatment.provider_page_id = target_provider_page_id
        and treatment.is_active
    );

  if cardinality(unique_treatment_ids) = 0 then
    return;
  end if;

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

comment on function ceaute.replace_add_on_treatment_compatibility(uuid, uuid, uuid[]) is
  'Replaces one add-on''s links to active treatments, keeping links to archived treatments. Called inside the add-on save so both changes share a transaction.';
