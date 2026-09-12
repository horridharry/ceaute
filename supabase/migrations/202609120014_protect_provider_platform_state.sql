revoke insert, update on table ceaute.provider_page from authenticated;

grant update (
  username,
  display_name,
  biography,
  provider_category,
  timezone,
  booking_window_days
) on table ceaute.provider_page to authenticated;

revoke insert, update on table ceaute.provider_payment_account
from authenticated, service_role;

create or replace function ceaute.provider_page_meets_publication_requirements(
  target_provider_page_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and (provider_page.status = 'draft' or provider_page.status = 'published')
      and nullif(btrim(provider_page.display_name), '') is not null
      and nullif(btrim(provider_page.username), '') is not null
      and nullif(btrim(provider_page.provider_category), '') is not null
      and nullif(btrim(provider_page.biography), '') is not null
      and exists (
        select 1
        from ceaute.provider_location
        where provider_location.provider_page_id = provider_page.id
          and provider_location.is_active = true
          and nullif(btrim(provider_location.public_area), '') is not null
          and nullif(btrim(provider_location.address_line_1), '') is not null
          and nullif(btrim(provider_location.city), '') is not null
          and nullif(btrim(provider_location.postcode), '') is not null
      )
      and exists (
        select 1
        from ceaute.availability_rule
        where availability_rule.provider_page_id = provider_page.id
      )
      and exists (
        select 1
        from ceaute.treatment
        where treatment.provider_page_id = provider_page.id
          and treatment.is_active = true
          and treatment.discovery_category_id is not null
          and treatment.price_pence > 0
          and treatment.duration_minutes > 0
      )
      and exists (
        select 1
        from ceaute.provider_booking_setting
        where provider_booking_setting.provider_page_id = provider_page.id
          and (
            provider_booking_setting.payment_mode = 'full'
            or provider_booking_setting.payment_mode = 'fixed_deposit'
          )
          and (
            provider_booking_setting.cancellation_window_hours = 12
            or provider_booking_setting.cancellation_window_hours = 24
            or provider_booking_setting.cancellation_window_hours = 48
          )
          and provider_booking_setting.commitment_amount_pence is not null
          and provider_booking_setting.commitment_amount_pence >= 0
      )
      and exists (
        select 1
        from ceaute.portfolio_image
        where portfolio_image.provider_page_id = provider_page.id
          and portfolio_image.is_visible = true
      )
      and exists (
        select 1
        from ceaute.provider_payment_account
        where provider_payment_account.provider_page_id = provider_page.id
          and provider_payment_account.recipient_applied = true
          and provider_payment_account.stripe_transfers_status = 'active'
          and provider_payment_account.payouts_status = 'active'
      )
  );
$$;

create or replace function ceaute.create_provider_page_draft(
  target_display_name text,
  target_username text,
  target_biography text
)
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  created_provider_page_id uuid;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  if nullif(btrim(target_display_name), '') is null
    or nullif(btrim(target_username), '') is null then
    raise exception 'Provider identity is incomplete.';
  end if;

  insert into ceaute.provider_page (
    owner_profile_id,
    display_name,
    username,
    biography,
    status
  ) values (
    current_profile_id,
    target_display_name,
    target_username,
    nullif(btrim(target_biography), ''),
    'draft'
  )
  returning id into created_provider_page_id;

  return created_provider_page_id;
end;
$$;

create or replace function ceaute.publish_provider_page()
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_provider_page ceaute.provider_page%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into target_provider_page
  from ceaute.provider_page
  where owner_profile_id = current_profile_id
  for update;

  if target_provider_page.id is null then
    raise exception 'Provider page not found.';
  end if;

  if target_provider_page.status = 'suspended' then
    raise exception 'Suspended pages cannot be published.';
  end if;

  if not ceaute.provider_page_meets_publication_requirements(target_provider_page.id) then
    raise exception 'Publication requirements are incomplete.';
  end if;

  update ceaute.provider_page
  set status = 'published',
      published_at = now()
  where id = target_provider_page.id;

  return target_provider_page.id;
end;
$$;

create or replace function ceaute.unpublish_provider_page()
returns uuid
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  current_profile_id uuid := auth.uid();
  target_provider_page ceaute.provider_page%rowtype;
begin
  if current_profile_id is null then
    raise exception 'Authentication required.';
  end if;

  select * into target_provider_page
  from ceaute.provider_page
  where owner_profile_id = current_profile_id
  for update;

  if target_provider_page.id is null then
    raise exception 'Provider page not found.';
  end if;

  if target_provider_page.status = 'suspended' then
    raise exception 'Suspended pages cannot be changed.';
  end if;

  if target_provider_page.status = 'published' then
    update ceaute.provider_page
    set status = 'draft'
    where id = target_provider_page.id;
  end if;

  return target_provider_page.id;
end;
$$;

create or replace function ceaute.sync_provider_payment_account(
  target_provider_page_id uuid,
  target_stripe_account_id text,
  target_dashboard text,
  target_identity_country text,
  target_recipient_applied boolean,
  target_stripe_transfers_status text,
  target_payouts_status text,
  target_requirements_currently_due text[],
  target_requirements_past_due text[],
  target_requirements_eventually_due text[]
)
returns void
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_stripe_account_id), '') is null then
    raise exception 'Stripe account ID is required.';
  end if;

  insert into ceaute.provider_payment_account (
    provider_page_id,
    stripe_account_id,
    dashboard,
    identity_country,
    recipient_applied,
    stripe_transfers_status,
    payouts_status,
    requirements_currently_due,
    requirements_past_due,
    requirements_eventually_due,
    last_stripe_update_at
  ) values (
    target_provider_page_id,
    target_stripe_account_id,
    target_dashboard,
    target_identity_country,
    target_recipient_applied,
    target_stripe_transfers_status,
    target_payouts_status,
    coalesce(target_requirements_currently_due, array[]::text[]),
    coalesce(target_requirements_past_due, array[]::text[]),
    coalesce(target_requirements_eventually_due, array[]::text[]),
    now()
  )
  on conflict (provider_page_id) do update
  set dashboard = excluded.dashboard,
      identity_country = excluded.identity_country,
      recipient_applied = excluded.recipient_applied,
      stripe_transfers_status = excluded.stripe_transfers_status,
      payouts_status = excluded.payouts_status,
      requirements_currently_due = excluded.requirements_currently_due,
      requirements_past_due = excluded.requirements_past_due,
      requirements_eventually_due = excluded.requirements_eventually_due,
      last_stripe_update_at = excluded.last_stripe_update_at
  where provider_payment_account.stripe_account_id = excluded.stripe_account_id;

  if not found then
    raise exception 'Stripe account reassignment is not allowed.';
  end if;
end;
$$;

revoke all on function ceaute.provider_page_meets_publication_requirements(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.create_provider_page_draft(text, text, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.publish_provider_page()
from public, anon, authenticated, service_role;
revoke all on function ceaute.unpublish_provider_page()
from public, anon, authenticated, service_role;
revoke all on function ceaute.sync_provider_payment_account(
  uuid, text, text, text, boolean, text, text, text[], text[], text[]
) from public, anon, authenticated, service_role;

grant execute on function ceaute.create_provider_page_draft(text, text, text)
to authenticated;
grant execute on function ceaute.publish_provider_page()
to authenticated;
grant execute on function ceaute.unpublish_provider_page()
to authenticated;
grant execute on function ceaute.sync_provider_payment_account(
  uuid, text, text, text, boolean, text, text, text[], text[], text[]
) to service_role;
