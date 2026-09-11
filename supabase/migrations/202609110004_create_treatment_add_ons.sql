create table if not exists ceaute.treatment_add_on (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  name varchar(100) not null,
  additional_price_pence bigint not null default 0 check (additional_price_pence >= 0),
  additional_duration_minutes integer not null default 0 check (additional_duration_minutes >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0 check (display_order >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, provider_page_id),
  constraint treatment_add_on_has_increase
    check (additional_price_pence > 0 or additional_duration_minutes > 0)
);

create table if not exists ceaute.treatment_add_on_compatibility (
  treatment_add_on_id uuid not null,
  treatment_id uuid not null,
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (treatment_add_on_id, treatment_id),
  foreign key (treatment_add_on_id, provider_page_id)
    references ceaute.treatment_add_on (id, provider_page_id)
    on delete restrict,
  foreign key (treatment_id, provider_page_id)
    references ceaute.treatment (id, provider_page_id)
    on delete restrict
);

create unique index if not exists treatment_add_on_provider_name_unique
  on ceaute.treatment_add_on (provider_page_id, lower(btrim(name)));

create index if not exists treatment_add_on_provider_active_order_idx
  on ceaute.treatment_add_on (provider_page_id, is_active, display_order, updated_at desc);

create index if not exists treatment_add_on_compatibility_treatment_idx
  on ceaute.treatment_add_on_compatibility (provider_page_id, treatment_id);

drop trigger if exists treatment_add_on_set_updated_at on ceaute.treatment_add_on;

create trigger treatment_add_on_set_updated_at
before update on ceaute.treatment_add_on
for each row execute function ceaute.set_updated_at();

alter table ceaute.treatment_add_on enable row level security;
alter table ceaute.treatment_add_on_compatibility enable row level security;

revoke all on ceaute.treatment_add_on from anon, authenticated;
revoke all on ceaute.treatment_add_on_compatibility from anon, authenticated;

grant select, insert, update on ceaute.treatment_add_on to authenticated;
grant select, insert, update, delete on ceaute.treatment_add_on_compatibility to authenticated;

create policy treatment_add_on_select_own_provider
on ceaute.treatment_add_on
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_add_on_insert_own_provider
on ceaute.treatment_add_on
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_add_on_update_own_provider
on ceaute.treatment_add_on
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_add_on_compatibility_select_own_provider
on ceaute.treatment_add_on_compatibility
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_add_on_compatibility_insert_own_provider
on ceaute.treatment_add_on_compatibility
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_add_on_compatibility_update_own_provider
on ceaute.treatment_add_on_compatibility
for update
to authenticated
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
);

create policy treatment_add_on_compatibility_delete_own_provider
on ceaute.treatment_add_on_compatibility
for delete
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment_add_on_compatibility.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
