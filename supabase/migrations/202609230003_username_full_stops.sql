-- Usernames may contain full stops between characters (approved 23 September
-- 2026), but never at the start or end and never two together. Length (3-30),
-- the character set and uniqueness are unchanged; usernames are lower case, so
-- the existing unique index is already case-insensitive.
--
-- Existing usernames are never rewritten. The new check is validated only when
-- none of them break it; otherwise it applies to every new or changed username
-- and the notice says how many are left.

alter table ceaute.provider_page
  drop constraint provider_page_username_format;

alter table ceaute.provider_page
  add constraint provider_page_username_format check (
    username is null or (
      username ~ '^[a-z0-9._]{3,30}$'
      and username !~ '^[.]'
      and username !~ '[.]$'
      and username !~ '[.][.]'
    )
  ) not valid;

do $migration$
declare
  nonconforming integer;
begin
  select count(*) into nonconforming
  from ceaute.provider_page
  where username is not null
    and (username ~ '^[.]' or username ~ '[.]$' or username ~ '[.][.]');

  if nonconforming = 0 then
    alter table ceaute.provider_page validate constraint provider_page_username_format;
  else
    raise notice '% existing username(s) break the full-stop rule; provider_page_username_format stays NOT VALID.', nonconforming;
  end if;
end;
$migration$;
