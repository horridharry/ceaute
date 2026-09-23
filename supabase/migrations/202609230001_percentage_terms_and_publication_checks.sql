-- Percentage booking terms, and one breakdown of the publication requirements.
--
-- Approved 23 September 2026 (docs/decisions/006-percentage-booking-terms.md):
--   * a provider chooses Full payment or Deposit and one percentage, a whole
--     number in 5% steps: Deposit 10-90%, Full payment 10-100%;
--   * in Deposit mode the percentage of the whole booking price is paid now,
--     with a £1 minimum and never more than the price;
--   * in both modes the same percentage is what a late customer cancellation
--     keeps, never more than was paid;
--   * rounding is to the nearest penny, half up, once, when the hold is made;
--   * existing fixed-£ settings are not converted: until the owner chooses a
--     percentage their booking terms are incomplete;
--   * bio is no longer a publication requirement, the current provider
--     agreement is, and a bookable treatment costs at least £1.
--
-- Nothing here reads or rewrites a booking snapshot. Historical bookings keep
-- the terms they were made on.

-- Booking settings ------------------------------------------------------------

alter table ceaute.provider_booking_setting
  add column deposit_percent smallint;

comment on column ceaute.provider_booking_setting.deposit_percent is
  'Provider-wide percentage: paid now in deposit mode, kept after a late customer cancellation in both modes.';
comment on column ceaute.provider_booking_setting.commitment_amount_pence is
  'Legacy fixed-£ amount. Read only for settings saved before percentage terms; new settings leave it null.';

alter table ceaute.provider_booking_setting
  drop constraint provider_booking_setting_payment_mode_check;

alter table ceaute.provider_booking_setting
  add constraint provider_booking_setting_payment_mode_check
  check (payment_mode in ('full', 'fixed_deposit', 'deposit'));

-- The one definition of "complete booking terms". The table constraint below,
-- the publication checks and the public quote all call it.
create function ceaute.booking_terms_are_complete(
  target_payment_mode text,
  target_deposit_percent integer,
  target_cancellation_window_hours integer
)
returns boolean
language sql
immutable
set search_path = ceaute, public
as $$
  select coalesce(
    target_payment_mode in ('full', 'deposit')
    and target_deposit_percent % 5 = 0
    and target_deposit_percent >= 10
    and target_deposit_percent <= case when target_payment_mode = 'deposit' then 90 else 100 end
    and target_cancellation_window_hours in (12, 24, 48),
    false
  );
$$;

-- Every insert or update must now save complete percentage terms, so no new
-- blank or fixed-£ setting can exist. NOT VALID leaves the rows saved before
-- this migration exactly as they are until their owner saves again; they
-- simply do not count as complete (see provider_page_publication_check_values).
alter table ceaute.provider_booking_setting
  add constraint provider_booking_setting_percentage_terms check (
    ceaute.booking_terms_are_complete(
      payment_mode, deposit_percent, cancellation_window_hours
    )
    and commitment_amount_pence is null
  ) not valid;

-- The money rule --------------------------------------------------------------

-- The only implementation of the rule. Every operand is a non-negative whole
-- number of pence, so integer division is the floor and the result is exact.
create function ceaute.booking_payment_terms(
  target_total_price_pence bigint,
  target_payment_mode text,
  target_deposit_percent integer
)
returns table (
  amount_due_now_pence bigint,
  amount_due_later_pence bigint,
  late_cancellation_retained_pence bigint
)
language plpgsql
immutable
set search_path = ceaute, public
as $$
declare
  percentage_amount bigint;
  due_now bigint;
begin
  if target_total_price_pence is null
    or target_total_price_pence < 0
    or not ceaute.booking_terms_are_complete(
      target_payment_mode, target_deposit_percent, 24
    ) then
    raise exception 'Invalid booking payment terms.';
  end if;

  -- Nearest penny, half up.
  percentage_amount := (target_total_price_pence * target_deposit_percent + 50) / 100;

  if target_payment_mode = 'deposit' then
    -- £1 minimum online payment, never more than the whole price.
    due_now := least(target_total_price_pence, greatest(percentage_amount, 100));
  else
    due_now := target_total_price_pence;
  end if;

  return query select
    due_now,
    target_total_price_pence - due_now,
    least(percentage_amount, due_now);
end;
$$;

revoke all on function ceaute.booking_terms_are_complete(text, integer, integer)
from public, anon, authenticated, service_role;
revoke all on function ceaute.booking_payment_terms(bigint, text, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.booking_terms_are_complete(text, integer, integer)
to authenticated, service_role;
grant execute on function ceaute.booking_payment_terms(bigint, text, integer)
to authenticated, service_role;

-- Treatments cost at least £1 -------------------------------------------------

-- Every new or changed treatment. Existing cheaper rows are left alone (they
-- simply cannot be booked, see create_validated_booking_hold) and the
-- constraint is validated here only when none exist.
alter table ceaute.treatment
  add constraint treatment_price_at_least_one_pound
  check (price_pence >= 100) not valid;

do $migration$
begin
  if not exists (select 1 from ceaute.treatment where price_pence < 100) then
    alter table ceaute.treatment validate constraint treatment_price_at_least_one_pound;
  else
    raise notice 'Some existing treatments cost less than £1; treatment_price_at_least_one_pound stays NOT VALID.';
  end if;
end;
$migration$;

-- The provider agreement --------------------------------------------------------

-- The version a provider must have accepted. Bumped by a migration whenever
-- docs/provider-agreement-draft.md changes in substance; the application's
-- PROVIDER_AGREEMENT_VERSION must match (tests/percentage-terms.test.js).
create function ceaute.current_provider_agreement_version()
returns text
language sql
immutable
set search_path = ceaute, public
as $$
  select '2026-09-18'::text;
$$;

revoke all on function ceaute.current_provider_agreement_version()
from public, anon, authenticated, service_role;
grant execute on function ceaute.current_provider_agreement_version()
to authenticated, service_role;

-- Publication requirements, broken down -----------------------------------------

-- One boolean per requirement. The publish rule, the setup guide, Today and
-- Settings -> Publication all read these, so they cannot disagree. Internal:
-- only other security-definer functions call it.
create function ceaute.provider_page_publication_check_values(
  target_provider_page_id uuid
)
returns table (
  has_business_profile boolean,
  has_bookable_treatment boolean,
  has_visible_photo boolean,
  has_current_location boolean,
  has_working_hours boolean,
  has_booking_terms boolean,
  payments_ready boolean,
  agreement_accepted boolean
)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select
    nullif(btrim(provider_page.display_name), '') is not null
      and nullif(btrim(provider_page.username), '') is not null
      and nullif(btrim(provider_page.provider_category), '') is not null,
    exists (
      select 1
      from ceaute.treatment
      where treatment.provider_page_id = provider_page.id
        and treatment.is_active = true
        and treatment.discovery_category_id is not null
        and treatment.price_pence >= 100
        and treatment.duration_minutes > 0
    ),
    exists (
      select 1
      from ceaute.portfolio_image
      where portfolio_image.provider_page_id = provider_page.id
        and portfolio_image.is_visible = true
    ),
    exists (
      select 1
      from ceaute.provider_location
      where provider_location.provider_page_id = provider_page.id
        and provider_location.is_primary = true
        and ceaute.provider_location_is_complete(
          provider_location.is_active,
          provider_location.public_area,
          provider_location.address_line_1,
          provider_location.city,
          provider_location.postcode
        )
    ),
    exists (
      select 1
      from ceaute.availability_rule
      where availability_rule.provider_page_id = provider_page.id
    ),
    exists (
      select 1
      from ceaute.provider_booking_setting
      where provider_booking_setting.provider_page_id = provider_page.id
        and ceaute.booking_terms_are_complete(
          provider_booking_setting.payment_mode,
          provider_booking_setting.deposit_percent,
          provider_booking_setting.cancellation_window_hours
        )
    ),
    exists (
      select 1
      from ceaute.provider_payment_account
      where provider_payment_account.provider_page_id = provider_page.id
        and provider_payment_account.recipient_applied = true
        and provider_payment_account.stripe_transfers_status = 'active'
        and provider_payment_account.payouts_status = 'active'
    ),
    exists (
      select 1
      from ceaute.provider_agreement_acceptance
      where provider_agreement_acceptance.provider_page_id = provider_page.id
        and provider_agreement_acceptance.agreement_version
          = ceaute.current_provider_agreement_version()
    )
  from ceaute.provider_page
  where provider_page.id = target_provider_page_id;
$$;

-- Redefined on the breakdown above. Bio is no longer required; the agreement
-- is; a bookable treatment costs at least £1; booking terms are percentage
-- terms.
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
    cross join lateral ceaute.provider_page_publication_check_values(provider_page.id) as checks
    where provider_page.id = target_provider_page_id
      and provider_page.status in ('draft', 'published')
      and checks.has_business_profile
      and checks.has_bookable_treatment
      and checks.has_visible_photo
      and checks.has_current_location
      and checks.has_working_hours
      and checks.has_booking_terms
      and checks.payments_ready
      and checks.agreement_accepted
  );
$$;

-- Whether a page may take a new booking now. Separate from publication: a live
-- page whose agreement is out of date, whose terms were never converted to a
-- percentage, whose Stripe account stopped being ready, or whose owner has an
-- outstanding balance stays published (Ceaute never unpublishes on its own)
-- but takes no new holds and no new Checkout.
create function ceaute.provider_page_accepts_new_bookings(
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
    cross join lateral ceaute.provider_page_publication_check_values(provider_page.id) as checks
    where provider_page.id = target_provider_page_id
      and provider_page.status = 'published'
      and checks.has_booking_terms
      and checks.payments_ready
      and checks.agreement_accepted
      and not exists (
        select 1
        from ceaute.provider_liability
        where provider_liability.provider_page_id = provider_page.id
          and provider_liability.status = 'outstanding'
          and provider_liability.outstanding_pence > 0
      )
  );
$$;

-- The owner's (or the trusted backend's) view of the breakdown. Anyone else
-- gets no row, so the function reveals nothing about another provider.
create function ceaute.get_provider_page_publication_checks(
  target_provider_page_id uuid
)
returns table (
  status text,
  has_business_profile boolean,
  has_bookable_treatment boolean,
  has_visible_photo boolean,
  has_current_location boolean,
  has_working_hours boolean,
  has_booking_terms boolean,
  payments_ready boolean,
  agreement_accepted boolean,
  meets_publication_requirements boolean,
  accepts_new_bookings boolean
)
language sql
stable
security definer
set search_path = ceaute, public
as $$
  select
    provider_page.status::text,
    checks.has_business_profile,
    checks.has_bookable_treatment,
    checks.has_visible_photo,
    checks.has_current_location,
    checks.has_working_hours,
    checks.has_booking_terms,
    checks.payments_ready,
    checks.agreement_accepted,
    ceaute.provider_page_meets_publication_requirements(provider_page.id),
    ceaute.provider_page_accepts_new_bookings(provider_page.id)
  from ceaute.provider_page
  cross join lateral ceaute.provider_page_publication_check_values(provider_page.id) as checks
  where provider_page.id = target_provider_page_id
    and (
      coalesce(auth.role(), '') = 'service_role'
      or provider_page.owner_profile_id = (select auth.uid())
    );
$$;

revoke all on function ceaute.provider_page_publication_check_values(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.provider_page_meets_publication_requirements(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.provider_page_accepts_new_bookings(uuid)
from public, anon, authenticated, service_role;
revoke all on function ceaute.get_provider_page_publication_checks(uuid)
from public, anon, authenticated, service_role;

grant execute on function ceaute.provider_page_accepts_new_bookings(uuid)
to service_role;
grant execute on function ceaute.get_provider_page_publication_checks(uuid)
to authenticated, service_role;

comment on function ceaute.provider_page_accepts_new_bookings(uuid) is
  'Published, complete percentage terms, Stripe ready, current agreement accepted and no outstanding balance.';

-- The customer's quote -------------------------------------------------------------

-- What Review shows before any hold exists, from the same rule the hold uses.
-- Public projection: nothing for a page that is not published.
create function ceaute.get_public_booking_terms(
  target_provider_page_id uuid,
  target_total_price_pence bigint
)
returns table (
  payment_mode text,
  deposit_percent smallint,
  cancellation_window_hours smallint,
  written_policy text,
  accepts_new_bookings boolean,
  amount_due_now_pence bigint,
  amount_due_later_pence bigint,
  late_cancellation_retained_pence bigint
)
language plpgsql
stable
security definer
set search_path = ceaute, public
as $$
declare
  setting ceaute.provider_booking_setting%rowtype;
  accepts boolean;
  terms record;
begin
  if not exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = target_provider_page_id
      and provider_page.status = 'published'
  ) then
    return;
  end if;

  select * into setting
  from ceaute.provider_booking_setting
  where provider_booking_setting.provider_page_id = target_provider_page_id;

  accepts := ceaute.provider_page_accepts_new_bookings(target_provider_page_id);

  if not accepts
    or not ceaute.booking_terms_are_complete(
      setting.payment_mode, setting.deposit_percent, setting.cancellation_window_hours
    )
    or target_total_price_pence is null
    or target_total_price_pence < 100 then
    return query select
      setting.payment_mode, setting.deposit_percent,
      setting.cancellation_window_hours, setting.written_policy,
      false, null::bigint, null::bigint, null::bigint;
    return;
  end if;

  select * into terms
  from ceaute.booking_payment_terms(
    target_total_price_pence, setting.payment_mode, setting.deposit_percent
  );

  return query select
    setting.payment_mode, setting.deposit_percent,
    setting.cancellation_window_hours, setting.written_policy,
    true,
    terms.amount_due_now_pence,
    terms.amount_due_later_pence,
    terms.late_cancellation_retained_pence;
end;
$$;

revoke all on function ceaute.get_public_booking_terms(uuid, bigint)
from public, anon, authenticated, service_role;
grant execute on function ceaute.get_public_booking_terms(uuid, bigint)
to authenticated, service_role;

comment on function ceaute.get_public_booking_terms(uuid, bigint) is
  'Public projection: booking terms and the amounts for a price, only for a published provider page.';
