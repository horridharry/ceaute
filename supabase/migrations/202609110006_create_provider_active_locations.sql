create table ceaute.provider_location (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  public_area varchar(120),
  address_line_1 varchar(160),
  address_line_2 varchar(160),
  city varchar(100),
  postcode varchar(12),
  country_code char(2) not null default 'GB' check (country_code = 'GB'),
  access_instructions text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_page_id),
  unique (id, provider_page_id)
);

create trigger provider_location_set_updated_at
before update on ceaute.provider_location
for each row execute function ceaute.set_updated_at();

alter table ceaute.provider_location enable row level security;

revoke all on ceaute.provider_location from anon, authenticated;
grant select, insert, update on ceaute.provider_location to authenticated;

create policy provider_location_select_own_provider
on ceaute.provider_location
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_location.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_location_insert_own_provider
on ceaute.provider_location
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_location.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_location_update_own_provider
on ceaute.provider_location
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_location.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_location.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
