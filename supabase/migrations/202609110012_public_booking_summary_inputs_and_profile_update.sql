grant update (full_name, phone_e164) on ceaute.profile to authenticated;

create policy profile_update_own_booking_details
on ceaute.profile
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create or replace function ceaute.get_public_provider_location(
  target_provider_page_id uuid
)
returns table (
  public_area varchar
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select provider_location.public_area
  from ceaute.provider_location
  join ceaute.provider_page
    on provider_page.id = provider_location.provider_page_id
  where provider_location.provider_page_id = target_provider_page_id
    and provider_page.status <> 'suspended'
  limit 1;
$$;

create or replace function ceaute.get_public_booking_settings(
  target_provider_page_id uuid
)
returns table (
  payment_mode text,
  commitment_amount_pence bigint,
  cancellation_window_hours smallint,
  written_policy text
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select
    provider_booking_setting.payment_mode,
    provider_booking_setting.commitment_amount_pence,
    provider_booking_setting.cancellation_window_hours,
    provider_booking_setting.written_policy
  from ceaute.provider_booking_setting
  join ceaute.provider_page
    on provider_page.id = provider_booking_setting.provider_page_id
  where provider_booking_setting.provider_page_id = target_provider_page_id
    and provider_page.status <> 'suspended'
  limit 1;
$$;

revoke all on function ceaute.get_public_provider_location(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_public_booking_settings(uuid)
from public, anon, authenticated;

grant execute on function ceaute.get_public_provider_location(uuid)
to anon, authenticated;
grant execute on function ceaute.get_public_booking_settings(uuid)
to anon, authenticated;
