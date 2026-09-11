create or replace function ceaute.get_public_availability_rules(
  target_provider_page_id uuid
)
returns table (
  weekday smallint,
  starts_at time,
  ends_at time
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select
    availability_rule.weekday,
    availability_rule.starts_at,
    availability_rule.ends_at
  from ceaute.availability_rule
  join ceaute.provider_page
    on provider_page.id = availability_rule.provider_page_id
  where availability_rule.provider_page_id = target_provider_page_id
    and provider_page.status <> 'suspended'
  order by availability_rule.weekday;
$$;

create or replace function ceaute.get_public_blocked_dates(
  target_provider_page_id uuid
)
returns table (
  local_date date
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select blocked_date.local_date
  from ceaute.blocked_date
  join ceaute.provider_page
    on provider_page.id = blocked_date.provider_page_id
  where blocked_date.provider_page_id = target_provider_page_id
    and provider_page.status <> 'suspended'
  order by blocked_date.local_date;
$$;

create or replace function ceaute.get_public_occupied_periods(
  target_provider_page_id uuid
)
returns table (
  start_at timestamptz,
  end_at timestamptz
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  select booking.start_at, booking.end_at
  from ceaute.booking
  join ceaute.provider_page
    on provider_page.id = booking.provider_page_id
  where booking.provider_page_id = target_provider_page_id
    and booking.status in ('awaiting_payment', 'confirmed')
    and booking.end_at > now()
    and provider_page.status <> 'suspended'
  order by booking.start_at;
$$;

revoke all on function ceaute.get_public_availability_rules(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_public_blocked_dates(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_public_occupied_periods(uuid)
from public, anon, authenticated;

grant execute on function ceaute.get_public_availability_rules(uuid)
to anon, authenticated;
grant execute on function ceaute.get_public_blocked_dates(uuid)
to anon, authenticated;
grant execute on function ceaute.get_public_occupied_periods(uuid)
to anon, authenticated;
