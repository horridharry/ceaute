create or replace function ceaute.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ceaute.profile (id, full_name)
  values (
    new.id,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

update ceaute.profile as profile
set full_name = nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '')
from auth.users as auth_user
where profile.id = auth_user.id
  and profile.full_name is null
  and nullif(btrim(auth_user.raw_user_meta_data ->> 'full_name'), '') is not null;
