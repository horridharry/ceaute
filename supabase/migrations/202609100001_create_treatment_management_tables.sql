create table ceaute.discovery_category (
  id uuid primary key default gen_random_uuid(),
  name varchar(100) not null,
  slug varchar(100) not null unique,
  search_terms text[] not null default '{}',
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint discovery_category_slug_format check (slug ~ '^[a-z0-9-]+$')
);

create trigger discovery_category_set_updated_at
before update on ceaute.discovery_category
for each row execute function ceaute.set_updated_at();

insert into ceaute.discovery_category (name, slug, search_terms, display_order)
values
  ('Acrylic nails', 'acrylic-nails', array['nails', 'extensions'], 10),
  ('Lash extensions', 'lash-extensions', array['lashes', 'eyelashes'], 20)
on conflict (slug) do nothing;

create table ceaute.treatment_group (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  name varchar(100) not null,
  display_order integer not null default 0 check (display_order >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, provider_page_id)
);

create unique index treatment_group_active_name_unique
  on ceaute.treatment_group (provider_page_id, lower(name))
  where is_active;

create index treatment_group_provider_order_idx
  on ceaute.treatment_group (provider_page_id, is_active, display_order, updated_at desc);

create trigger treatment_group_set_updated_at
before update on ceaute.treatment_group
for each row execute function ceaute.set_updated_at();

alter table ceaute.treatment
  add column discovery_category_id uuid references ceaute.discovery_category (id) on delete restrict,
  add column treatment_group_id uuid;

alter table ceaute.treatment
  add constraint treatment_group_same_provider
  foreign key (treatment_group_id, provider_page_id)
  references ceaute.treatment_group (id, provider_page_id)
  on delete restrict;

create index treatment_discovery_category_active_idx
  on ceaute.treatment (discovery_category_id, is_active);

create index treatment_provider_active_order_idx
  on ceaute.treatment (provider_page_id, is_active, display_order, updated_at desc);

alter table ceaute.discovery_category enable row level security;
alter table ceaute.treatment_group enable row level security;

revoke all on ceaute.discovery_category from anon, authenticated;
revoke all on ceaute.treatment_group from anon, authenticated;

grant select on ceaute.discovery_category to authenticated;
grant select, insert, update on ceaute.treatment_group to authenticated;

create policy discovery_category_select_active
on ceaute.discovery_category
for select
to authenticated
using (is_active);

create policy treatment_group_select_own_provider
on ceaute.treatment_group
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_group_insert_own_provider
on ceaute.treatment_group
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_group_update_own_provider
on ceaute.treatment_group
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_group.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
