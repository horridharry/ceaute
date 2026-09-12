create index if not exists booking_confirmed_end_at_idx
  on ceaute.booking (end_at)
  where status = 'confirmed';

create or replace function ceaute.complete_elapsed_bookings(
  max_bookings integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  completed_count integer;
begin
  with eligible_bookings as (
    select id
    from ceaute.booking
    where status = 'confirmed'
      and end_at <= now()
    order by end_at
    limit greatest(1, least(coalesce(max_bookings, 500), 1000))
    for update skip locked
  ),
  updated_bookings as (
    update ceaute.booking
    set status = 'completed'
    where id in (select id from eligible_bookings)
      and status = 'confirmed'
      and end_at <= now()
    returning id
  )
  select count(*) into completed_count
  from updated_bookings;

  return completed_count;
end;
$$;

revoke all on function ceaute.complete_elapsed_bookings(integer)
from public, anon, authenticated;

grant execute on function ceaute.complete_elapsed_bookings(integer)
to service_role;

