create extension if not exists btree_gist;

alter table ceaute.booking
  add column if not exists expires_at timestamptz,
  add column if not exists confirmed_at timestamptz;

update ceaute.booking
set expires_at = created_at + interval '10 minutes'
where status = 'awaiting_payment'
  and expires_at is null;

alter table ceaute.booking
  add constraint booking_hold_has_expiry
  check (status <> 'awaiting_payment' or expires_at is not null);

alter table ceaute.booking
  add constraint booking_no_active_overlap
  exclude using gist (
    provider_page_id with =,
    tstzrange(start_at, end_at, '[)') with &&
  )
  where (status in ('awaiting_payment', 'confirmed'));

drop policy if exists booking_select_provider_or_customer on ceaute.booking;

create policy booking_select_confirmed_provider_or_customer
on ceaute.booking
for select
to authenticated
using (
  status <> 'awaiting_payment'
  and (
    customer_profile_id = (select auth.uid())
    or exists (
      select 1
      from ceaute.provider_page
      where provider_page.id = booking.provider_page_id
        and provider_page.owner_profile_id = (select auth.uid())
    )
  )
);

create or replace function ceaute.expire_provider_booking_holds(
  target_provider_page_id uuid
)
returns void
language sql
security definer
set search_path = ceaute, public
as $$
  update ceaute.booking
  set status = 'cancelled'
  where provider_page_id = target_provider_page_id
    and status = 'awaiting_payment'
    and expires_at <= now();
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
    and (
      booking.status = 'confirmed'
      or (
        booking.status = 'awaiting_payment'
        and booking.expires_at > now()
      )
    )
    and booking.end_at > now()
    and provider_page.status <> 'suspended'
  order by booking.start_at;
$$;

create or replace function ceaute.create_booking_hold(
  target_provider_page_id uuid,
  target_treatment_id uuid,
  selected_add_on_ids uuid[],
  requested_start_at timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  customer_profile ceaute.profile%rowtype;
  provider_page ceaute.provider_page%rowtype;
  selected_treatment ceaute.treatment%rowtype;
  location ceaute.provider_location%rowtype;
  booking_setting ceaute.provider_booking_setting%rowtype;
  unique_add_on_ids uuid[];
  selected_add_ons jsonb;
  selected_add_on_count integer;
  total_duration_minutes integer;
  total_price_pence bigint;
  requested_end_at timestamptz;
  hold_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  perform ceaute.expire_provider_booking_holds(target_provider_page_id);

  select * into customer_profile
  from ceaute.profile
  where id = current_profile_id;

  if customer_profile.id is null
    or nullif(btrim(customer_profile.full_name), '') is null
    or nullif(btrim(customer_profile.phone_e164), '') is null then
    raise exception 'Customer details are incomplete.';
  end if;

  select * into provider_page
  from ceaute.provider_page
  where id = target_provider_page_id
    and status <> 'suspended';

  if provider_page.id is null then
    raise exception 'Provider page not found.';
  end if;

  select * into selected_treatment
  from ceaute.treatment
  where id = target_treatment_id
    and provider_page_id = target_provider_page_id
    and is_active = true;

  if selected_treatment.id is null then
    raise exception 'Treatment not available.';
  end if;

  unique_add_on_ids := coalesce(
    array(select distinct unnest(coalesce(selected_add_on_ids, array[]::uuid[]))),
    array[]::uuid[]
  );

  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', treatment_add_on.id,
      'name', treatment_add_on.name,
      'additional_price_pence', treatment_add_on.additional_price_pence,
      'additional_duration_minutes', treatment_add_on.additional_duration_minutes
    ) order by treatment_add_on.display_order, treatment_add_on.name), '[]'::jsonb),
    count(*),
    selected_treatment.duration_minutes + coalesce(sum(treatment_add_on.additional_duration_minutes), 0),
    selected_treatment.price_pence + coalesce(sum(treatment_add_on.additional_price_pence), 0)
  into selected_add_ons, selected_add_on_count, total_duration_minutes, total_price_pence
  from ceaute.treatment_add_on
  join ceaute.treatment_add_on_compatibility
    on treatment_add_on_compatibility.treatment_add_on_id = treatment_add_on.id
    and treatment_add_on_compatibility.provider_page_id = treatment_add_on.provider_page_id
  where treatment_add_on.provider_page_id = target_provider_page_id
    and treatment_add_on.is_active = true
    and treatment_add_on.id = any(unique_add_on_ids)
    and treatment_add_on_compatibility.treatment_id = target_treatment_id;

  if selected_add_on_count <> cardinality(unique_add_on_ids) then
    raise exception 'Selected add-ons are not available.';
  end if;

  requested_end_at := requested_start_at + make_interval(mins => total_duration_minutes);

  select * into location
  from ceaute.provider_location
  where provider_page_id = target_provider_page_id
  limit 1;

  select * into booking_setting
  from ceaute.provider_booking_setting
  where provider_page_id = target_provider_page_id;

  insert into ceaute.booking (
    customer_profile_id,
    provider_page_id,
    treatment_id,
    start_at,
    end_at,
    status,
    expires_at,
    customer_snapshot,
    service_snapshot
  )
  values (
    current_profile_id,
    target_provider_page_id,
    target_treatment_id,
    requested_start_at,
    requested_end_at,
    'awaiting_payment',
    now() + interval '10 minutes',
    jsonb_build_object(
      'full_name', customer_profile.full_name,
      'email', auth.jwt() ->> 'email',
      'phone', customer_profile.phone_e164
    ),
    jsonb_build_object(
      'provider_display_name', provider_page.display_name,
      'provider_username', provider_page.username,
      'treatment_name', selected_treatment.name,
      'treatment_description', selected_treatment.description,
      'selected_add_ons', selected_add_ons,
      'start_at', requested_start_at,
      'end_at', requested_end_at,
      'duration_minutes', total_duration_minutes,
      'public_area', location.public_area,
      'address_line_1', location.address_line_1,
      'address_line_2', location.address_line_2,
      'city', location.city,
      'postcode', location.postcode,
      'access_instructions', location.access_instructions,
      'total_price_pence', total_price_pence,
      'payment_mode', coalesce(booking_setting.payment_mode, 'full'),
      'commitment_amount_pence', booking_setting.commitment_amount_pence,
      'cancellation_window_hours', coalesce(booking_setting.cancellation_window_hours, 24),
      'written_policy', booking_setting.written_policy
    )
  )
  returning id into hold_id;

  return hold_id;
end;
$$;

create or replace function ceaute.confirm_test_booking_hold(
  target_booking_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  existing_booking ceaute.booking%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into existing_booking
  from ceaute.booking
  where id = target_booking_id
    and customer_profile_id = current_profile_id;

  if existing_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  if existing_booking.status = 'confirmed' then
    return existing_booking.id;
  end if;

  if existing_booking.status <> 'awaiting_payment'
    or existing_booking.expires_at <= now() then
    raise exception 'Booking hold has expired.';
  end if;

  update ceaute.booking
  set status = 'confirmed',
      confirmed_at = coalesce(confirmed_at, now())
  where id = target_booking_id
    and status = 'awaiting_payment'
    and expires_at > now()
  returning * into existing_booking;

  if existing_booking.id is null then
    raise exception 'Booking could not be confirmed.';
  end if;

  return existing_booking.id;
end;
$$;

create or replace function ceaute.get_booking_hold_summary(
  target_booking_id uuid
)
returns table (
  id uuid,
  status text,
  start_at timestamptz,
  end_at timestamptz,
  expires_at timestamptz,
  customer_snapshot jsonb,
  service_snapshot jsonb
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  update ceaute.booking
  set status = 'cancelled'
  where booking.id = target_booking_id
    and booking.status = 'awaiting_payment'
    and booking.expires_at <= now();

  return query
  select
    booking.id,
    booking.status,
    booking.start_at,
    booking.end_at,
    booking.expires_at,
    booking.customer_snapshot,
    case
      when booking.status = 'awaiting_payment' then
        booking.service_snapshot
        - 'address_line_1'
        - 'address_line_2'
        - 'city'
        - 'postcode'
        - 'access_instructions'
      else booking.service_snapshot
    end as service_snapshot
  from ceaute.booking
  where booking.id = target_booking_id
    and (
      booking.customer_profile_id = (select auth.uid())
      or (
        booking.status <> 'awaiting_payment'
        and exists (
          select 1
          from ceaute.provider_page
          where provider_page.id = booking.provider_page_id
            and provider_page.owner_profile_id = (select auth.uid())
        )
      )
    );
end;
$$;

revoke all on function ceaute.expire_provider_booking_holds(uuid)
from public, anon, authenticated;
revoke all on function ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz)
from public, anon, authenticated;
revoke all on function ceaute.confirm_test_booking_hold(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_booking_hold_summary(uuid)
from public, anon, authenticated;
revoke all on function ceaute.get_public_occupied_periods(uuid)
from public, anon, authenticated;

grant execute on function ceaute.create_booking_hold(uuid, uuid, uuid[], timestamptz)
to authenticated;
grant execute on function ceaute.confirm_test_booking_hold(uuid)
to authenticated;
grant execute on function ceaute.get_booking_hold_summary(uuid)
to authenticated;
grant execute on function ceaute.get_public_occupied_periods(uuid)
to anon, authenticated;
