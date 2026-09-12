drop trigger if exists profile_clear_phone_verification_on_change on ceaute.profile;
drop function if exists ceaute.clear_phone_verification_on_change();
drop table if exists ceaute.phone_verification_request;

create or replace function ceaute.create_booking_review(
  target_booking_id uuid,
  review_rating integer,
  review_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_booking ceaute.booking%rowtype;
  cleaned_comment text;
  review_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if review_rating < 1 or review_rating > 5 then
    raise exception 'Choose a rating from 1 to 5.';
  end if;

  select * into target_booking
  from ceaute.booking
  where id = target_booking_id
  for update;

  if target_booking.id is null
    or target_booking.customer_profile_id <> current_profile_id then
    raise exception 'Booking not found.';
  end if;

  if target_booking.status <> 'completed' then
    raise exception 'Only completed bookings can be reviewed.';
  end if;

  if exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_booking.provider_page_id
      and provider_page.owner_profile_id = current_profile_id
  ) then
    raise exception 'You cannot review your own provider page.';
  end if;

  cleaned_comment := nullif(btrim(coalesce(review_comment, '')), '');

  if length(coalesce(cleaned_comment, '')) > 1000 then
    raise exception 'Review comments must be 1000 characters or fewer.';
  end if;

  insert into ceaute.booking_review (
    booking_id,
    provider_page_id,
    customer_profile_id,
    rating,
    comment
  )
  values (
    target_booking.id,
    target_booking.provider_page_id,
    current_profile_id,
    review_rating,
    cleaned_comment
  )
  on conflict (booking_id) do nothing
  returning id into review_id;

  if review_id is null then
    select id into review_id
    from ceaute.booking_review
    where booking_id = target_booking.id
      and customer_profile_id = current_profile_id;
  end if;

  if review_id is null then
    raise exception 'Review could not be saved.';
  end if;

  return review_id;
end;
$$;

revoke all on function ceaute.create_booking_review(uuid, integer, text)
from public, anon, authenticated;

grant execute on function ceaute.create_booking_review(uuid, integer, text)
to authenticated;
