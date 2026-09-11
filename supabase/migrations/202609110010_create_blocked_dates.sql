create table ceaute.blocked_date (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete cascade,
  local_date date not null,
  reason varchar(200),
  created_at timestamptz not null default now(),
  unique (provider_page_id, local_date)
);

create index blocked_date_provider_local_date_idx
  on ceaute.blocked_date (provider_page_id, local_date);

alter table ceaute.blocked_date enable row level security;

revoke all on ceaute.blocked_date from anon, authenticated;

grant select, insert, delete on ceaute.blocked_date to authenticated;

create policy blocked_date_select_own_provider
on ceaute.blocked_date
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = blocked_date.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy blocked_date_insert_own_provider
on ceaute.blocked_date
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = blocked_date.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy blocked_date_delete_own_provider
on ceaute.blocked_date
for delete
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = blocked_date.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
