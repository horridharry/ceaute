-- Per-date booking counts for the provider Availability screen.
--
-- Security definer is needed because row-level security hides holds from
-- providers: booking_select_paid_detail_participant only exposes confirmed or
-- completed bookings with confirmed_at set, so a provider cannot see payments
-- in progress. This function checks ownership of the provider page itself,
-- returns nothing for anyone else, and exposes only per-date counts (no
-- customer, treatment or payment details). RLS on booking is unchanged.
-- The counts are advisory; booking rules stay in create_validated_booking_hold
-- and complete_booking_payment_attempt.
create function ceaute.get_provider_booking_counts_by_local_date(target_provider_page_id uuid)
returns table (local_date date, confirmed_count integer, in_progress_count integer)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select (booking.start_at at time zone 'Europe/London')::date as local_date,
         (count(*) filter (where booking.status = 'confirmed'))::integer as confirmed_count,
         (count(*) filter (where booking.status = 'awaiting_payment'
                             and booking.expires_at > now()))::integer as in_progress_count
  from ceaute.booking
  where booking.provider_page_id = target_provider_page_id
    and exists (
      select 1
      from ceaute.provider_page
      where provider_page.id = target_provider_page_id
        and provider_page.owner_profile_id = (select auth.uid())
    )
    and (booking.start_at at time zone 'Europe/London')::date
        >= (now() at time zone 'Europe/London')::date
    and (
      booking.status = 'confirmed'
      or (booking.status = 'awaiting_payment' and booking.expires_at > now())
    )
  group by 1
  order by 1;
$$;

revoke all on function ceaute.get_provider_booking_counts_by_local_date(uuid)
from public, anon, authenticated;
grant execute on function ceaute.get_provider_booking_counts_by_local_date(uuid)
to authenticated;
