-- Every provider page belongs to ceaute.profile, while authentication belongs
-- to auth.users. The existing auth_user_create_profile trigger handles a true
-- new auth.users insert. It cannot repair an Auth identity that survives an
-- application-data wipe, because signing in to that identity inserts no new
-- auth.users row and therefore fires no trigger. Restore the missing side of
-- that relationship for every surviving Auth identity.
insert into ceaute.profile (id, full_name)
select
  auth_user.id,
  nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')
from auth.users as auth_user
on conflict (id) do nothing;

-- Onboarding is also a safe repair boundary for an already-authenticated
-- account. It may recreate only the current auth user's own missing profile;
-- ownership and every later provider write remain protected as before.
create or replace function ceaute.create_provider_page_draft(
  target_display_name text,
  target_username text,
  target_biography text
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  created_provider_page_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(btrim(target_display_name), '') is null
    or nullif(btrim(target_username), '') is null then
    raise exception 'Provider identity is incomplete.';
  end if;

  insert into ceaute.profile (id, full_name)
  select
    auth_user.id,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')
  from auth.users as auth_user
  where auth_user.id = current_profile_id
  on conflict (id) do nothing;

  insert into ceaute.provider_page (
    owner_profile_id,
    display_name,
    username,
    biography,
    status
  ) values (
    current_profile_id,
    target_display_name,
    target_username,
    nullif(btrim(target_biography), ''),
    'draft'
  )
  returning id into created_provider_page_id;

  return created_provider_page_id;
end;
$$;

revoke all on function ceaute.create_provider_page_draft(text, text, text)
from public, anon, authenticated, service_role;

grant execute on function ceaute.create_provider_page_draft(text, text, text)
to authenticated;
