create table ceaute.provider_booking_setting (
  provider_page_id uuid primary key references ceaute.provider_page (id) on delete restrict,
  payment_mode text check (payment_mode in ('full', 'fixed_deposit')),
  commitment_amount_pence bigint check (
    commitment_amount_pence is null or commitment_amount_pence >= 0
  ),
  cancellation_window_hours smallint check (
    cancellation_window_hours is null
    or cancellation_window_hours in (12, 24, 48)
  ),
  written_policy text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger provider_booking_setting_set_updated_at
before update on ceaute.provider_booking_setting
for each row execute function ceaute.set_updated_at();

alter table ceaute.provider_booking_setting enable row level security;

revoke all on ceaute.provider_booking_setting from anon, authenticated;
grant select, insert, update on ceaute.provider_booking_setting to authenticated;

create policy provider_booking_setting_select_own_provider
on ceaute.provider_booking_setting
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_booking_setting.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_booking_setting_insert_own_provider
on ceaute.provider_booking_setting
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_booking_setting.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_booking_setting_update_own_provider
on ceaute.provider_booking_setting
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_booking_setting.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = provider_booking_setting.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
