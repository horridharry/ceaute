create extension if not exists pgcrypto;

create schema if not exists ceaute;

revoke all on schema ceaute from public, anon;
grant usage on schema ceaute to authenticated, service_role;

create table ceaute.profile (
  id uuid primary key references auth.users (id) on delete restrict,
  full_name varchar(120),
  phone_e164 varchar(20),
  phone_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table ceaute.provider_page (
  id uuid primary key default gen_random_uuid(),
  owner_profile_id uuid not null unique references ceaute.profile (id) on delete restrict,
  username varchar(30),
  display_name varchar(120),
  biography varchar(500),
  status text not null default 'draft' check (status in ('draft', 'published', 'suspended')),
  timezone text not null default 'Europe/London',
  booking_window_days smallint not null default 30 check (booking_window_days in (30, 60, 90)),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_page_username_format check (
    username is null or username ~ '^[a-z0-9._]{3,30}$'
  )
);

create unique index provider_page_username_unique
  on ceaute.provider_page (username)
  where username is not null;

create or replace function ceaute.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profile_set_updated_at
before update on ceaute.profile
for each row execute function ceaute.set_updated_at();

create trigger provider_page_set_updated_at
before update on ceaute.provider_page
for each row execute function ceaute.set_updated_at();

create or replace function ceaute.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into ceaute.profile (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger auth_user_create_profile
after insert on auth.users
for each row execute function ceaute.create_profile_for_auth_user();

insert into ceaute.profile (id)
select id from auth.users
on conflict (id) do nothing;

alter table ceaute.profile enable row level security;
alter table ceaute.provider_page enable row level security;

revoke all on ceaute.profile from anon, authenticated;
revoke all on ceaute.provider_page from anon, authenticated;

grant select on ceaute.profile to authenticated;
grant select, insert, update on ceaute.provider_page to authenticated;

create policy profile_select_own
on ceaute.profile
for select
to authenticated
using ((select auth.uid()) = id);

create policy provider_page_select_own
on ceaute.provider_page
for select
to authenticated
using ((select auth.uid()) = owner_profile_id);

create policy provider_page_insert_own
on ceaute.provider_page
for insert
to authenticated
with check ((select auth.uid()) = owner_profile_id);

create policy provider_page_update_own
on ceaute.provider_page
for update
to authenticated
using ((select auth.uid()) = owner_profile_id)
with check ((select auth.uid()) = owner_profile_id);

grant usage, select on all sequences in schema ceaute to authenticated, service_role;
