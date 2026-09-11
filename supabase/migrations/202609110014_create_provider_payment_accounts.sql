create table ceaute.provider_payment_account (
  provider_page_id uuid primary key references ceaute.provider_page (id) on delete restrict,
  stripe_account_id text not null unique,
  details_submitted boolean not null default false,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  currently_due text[] not null default array[]::text[],
  last_stripe_update_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger provider_payment_account_set_updated_at
before update on ceaute.provider_payment_account
for each row execute function ceaute.set_updated_at();

alter table ceaute.provider_payment_account enable row level security;

revoke all on ceaute.provider_payment_account from anon, authenticated;

grant select, insert, update on ceaute.provider_payment_account to authenticated;

create policy provider_payment_account_select_own_provider
on ceaute.provider_payment_account
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_payment_account.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_payment_account_insert_own_provider
on ceaute.provider_payment_account
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_payment_account.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_payment_account_update_own_provider
on ceaute.provider_payment_account
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_payment_account.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_payment_account.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create table ceaute.stripe_connect_event (
  id text primary key,
  type text not null,
  stripe_account_id text,
  processed_at timestamptz not null default now()
);

alter table ceaute.stripe_connect_event enable row level security;

revoke all on ceaute.stripe_connect_event from anon, authenticated;
