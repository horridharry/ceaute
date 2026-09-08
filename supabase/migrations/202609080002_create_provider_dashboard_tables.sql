create table ceaute.treatment (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  name varchar(120) not null,
  description text,
  duration_minutes integer not null check (duration_minutes > 0),
  price_pence bigint not null check (price_pence > 0),
  image_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, provider_page_id)
);

create table ceaute.availability_rule (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  starts_at time not null,
  ends_at time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_page_id, weekday),
  constraint availability_rule_valid_time check (ends_at > starts_at)
);

create table ceaute.booking (
  id uuid primary key default gen_random_uuid(),
  customer_profile_id uuid not null references ceaute.profile (id) on delete restrict,
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  treatment_id uuid references ceaute.treatment (id) on delete restrict,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status text not null default 'confirmed' check (status in ('awaiting_payment', 'confirmed', 'completed', 'cancelled')),
  customer_snapshot jsonb not null default '{}'::jsonb,
  service_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_valid_time check (end_at > start_at)
);

create trigger treatment_set_updated_at
before update on ceaute.treatment
for each row execute function ceaute.set_updated_at();

create trigger availability_rule_set_updated_at
before update on ceaute.availability_rule
for each row execute function ceaute.set_updated_at();

create trigger booking_set_updated_at
before update on ceaute.booking
for each row execute function ceaute.set_updated_at();

alter table ceaute.treatment enable row level security;
alter table ceaute.availability_rule enable row level security;
alter table ceaute.booking enable row level security;

revoke all on ceaute.treatment from anon, authenticated;
revoke all on ceaute.availability_rule from anon, authenticated;
revoke all on ceaute.booking from anon, authenticated;

grant select, insert, update on ceaute.treatment to authenticated;
grant select, insert, update, delete on ceaute.availability_rule to authenticated;
grant select on ceaute.booking to authenticated;

create policy treatment_select_own_provider
on ceaute.treatment
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_insert_own_provider
on ceaute.treatment
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_update_own_provider
on ceaute.treatment
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = treatment.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy availability_rule_select_own_provider
on ceaute.availability_rule
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_rule.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy availability_rule_insert_own_provider
on ceaute.availability_rule
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_rule.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy availability_rule_update_own_provider
on ceaute.availability_rule
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_rule.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_rule.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy availability_rule_delete_own_provider
on ceaute.availability_rule
for delete
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = availability_rule.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy booking_select_provider_or_customer
on ceaute.booking
for select
to authenticated
using (
  customer_profile_id = (select auth.uid())
  or exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = booking.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create index treatment_provider_page_order_idx
  on ceaute.treatment (provider_page_id, is_active, display_order, updated_at desc);

create index availability_rule_provider_page_weekday_idx
  on ceaute.availability_rule (provider_page_id, weekday);

create index booking_provider_page_start_at_idx
  on ceaute.booking (provider_page_id, start_at);

