-- Provider liability accounting and agreement acceptance.
--
-- When a provider-responsible dispute is lost, Stripe can only take back what
-- is still sitting in the connected account. Anything it cannot reach is a real
-- debt, and pretending otherwise is how a marketplace quietly funds its own
-- providers. This records it.
--
-- Two things it deliberately does NOT record as provider debt: Stripe's
-- dispute fee, which Stripe's Connect terms forbid passing to a connected
-- account, and anything arising from a Ceaute-caused dispute.

create table ceaute.provider_liability (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  booking_id uuid references ceaute.booking (id) on delete restrict,
  booking_payment_attempt_id uuid references ceaute.booking_payment_attempt (id) on delete restrict,
  stripe_dispute_id text,
  reason text not null check (reason in ('dispute_lost_provider_responsible')),
  amount_owed_pence bigint not null check (amount_owed_pence >= 0),
  amount_recovered_pence bigint not null default 0 check (amount_recovered_pence >= 0),
  -- Derived so it can never disagree with the two amounts above.
  outstanding_pence bigint generated always as (
    greatest(0, amount_owed_pence - amount_recovered_pence)
  ) stored,
  status text not null default 'outstanding' check (
    status in ('outstanding', 'recovered', 'written_off')
  ),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint provider_liability_not_over_recovered
    check (amount_recovered_pence <= amount_owed_pence),
  -- Idempotency: one liability per source event. Recording the same lost
  -- dispute twice updates this row rather than doubling the debt.
  constraint provider_liability_unique_source unique (reason, stripe_dispute_id)
);

create index provider_liability_outstanding_idx
  on ceaute.provider_liability (provider_page_id, status)
  where status = 'outstanding';

create trigger provider_liability_set_updated_at
before update on ceaute.provider_liability
for each row execute function ceaute.set_updated_at();

alter table ceaute.provider_liability enable row level security;

-- Providers cannot read or change their own liabilities from the product: the
-- amounts come from dispute outcomes an operator decides, and a provider-facing
-- view is a product decision nobody has made.
revoke all on ceaute.provider_liability from anon, authenticated;
grant select, insert, update on ceaute.provider_liability to service_role;

-- --- agreement acceptance ---------------------------------------------------

-- The minimum versioned acceptance, not a signing system. A row is written
-- once and never changed; accepting a new version writes a new row, so the
-- history of what a provider agreed to, and when, is intact.
create table ceaute.provider_agreement_acceptance (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  agreement_version text not null,
  accepted_at timestamptz not null default now(),
  accepted_by_profile_id uuid not null references ceaute.profile (id) on delete restrict,
  unique (provider_page_id, agreement_version)
);

alter table ceaute.provider_agreement_acceptance enable row level security;

revoke all on ceaute.provider_agreement_acceptance from anon, authenticated;
grant select, insert on ceaute.provider_agreement_acceptance to authenticated;
grant select, insert on ceaute.provider_agreement_acceptance to service_role;

-- A provider may read and write only their own acceptance, and there is no
-- update or delete policy at all, which is what makes the record immutable.
create policy provider_agreement_acceptance_select_own
on ceaute.provider_agreement_acceptance
for select
to authenticated
using (
  exists (
    select 1 from ceaute.provider_page
    where provider_page.id = provider_agreement_acceptance.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_agreement_acceptance_insert_own
on ceaute.provider_agreement_acceptance
for insert
to authenticated
with check (
  accepted_by_profile_id = (select auth.uid())
  and exists (
    select 1 from ceaute.provider_page
    where provider_page.id = provider_agreement_acceptance.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

-- --- recording and recovery -------------------------------------------------

create function ceaute.record_provider_liability(
  target_stripe_dispute_id text,
  target_amount_owed_pence bigint,
  target_note text default null
)
returns table (
  out_liability_id uuid,
  out_provider_page_id uuid,
  out_amount_owed_pence bigint,
  out_outstanding_pence bigint,
  out_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  dispute ceaute.booking_dispute%rowtype;
  target_booking ceaute.booking%rowtype;
  liability ceaute.provider_liability%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into dispute
  from ceaute.booking_dispute
  where stripe_dispute_id = target_stripe_dispute_id;

  if dispute.id is null then
    raise exception 'Dispute not found.';
  end if;

  if dispute.responsibility <> 'provider' then
    raise exception 'Only a provider-responsible dispute creates provider liability.';
  end if;

  if dispute.booking_id is null then
    raise exception 'Dispute is not linked to a booking.';
  end if;

  select * into target_booking from ceaute.booking where id = dispute.booking_id;

  insert into ceaute.provider_liability (
    provider_page_id,
    booking_id,
    booking_payment_attempt_id,
    stripe_dispute_id,
    reason,
    amount_owed_pence,
    note
  ) values (
    target_booking.provider_page_id,
    dispute.booking_id,
    dispute.booking_payment_attempt_id,
    dispute.stripe_dispute_id,
    'dispute_lost_provider_responsible',
    greatest(0, coalesce(target_amount_owed_pence, 0)),
    nullif(btrim(target_note), '')
  )
  on conflict on constraint provider_liability_unique_source do update set
    -- The owed amount can be corrected, but never below what has already been
    -- recovered, and recovery is never rewound by a replay.
    amount_owed_pence = greatest(
      excluded.amount_owed_pence,
      provider_liability.amount_recovered_pence
    ),
    note = coalesce(excluded.note, provider_liability.note)
  returning * into liability;

  return query select
    liability.id,
    liability.provider_page_id,
    liability.amount_owed_pence,
    liability.outstanding_pence,
    liability.status;
end;
$$;

-- Recovery is additive and idempotent by Stripe object id: recording the same
-- transfer reversal twice does not count the money twice.
create function ceaute.record_provider_liability_recovery(
  target_liability_id uuid,
  target_recovered_pence bigint,
  target_reference text default null
)
returns table (
  out_liability_id uuid,
  out_amount_recovered_pence bigint,
  out_outstanding_pence bigint,
  out_status text
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  liability ceaute.provider_liability%rowtype;
  recovered bigint;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  select * into liability
  from ceaute.provider_liability
  where id = target_liability_id
  for update;

  if liability.id is null then
    raise exception 'Provider liability not found.';
  end if;

  -- Already counted: the same reversal replayed changes nothing.
  if target_reference is not null
    and liability.note is not null
    and position(target_reference in liability.note) > 0 then
    return query select
      liability.id,
      liability.amount_recovered_pence,
      liability.outstanding_pence,
      liability.status;
    return;
  end if;

  recovered := least(
    liability.amount_owed_pence,
    liability.amount_recovered_pence + greatest(0, coalesce(target_recovered_pence, 0))
  );

  update ceaute.provider_liability
  set amount_recovered_pence = recovered,
      status = case when recovered >= liability.amount_owed_pence then 'recovered' else 'outstanding' end,
      resolved_at = case when recovered >= liability.amount_owed_pence then now() else null end,
      note = case
        when target_reference is null then note
        else concat_ws(' ', note, 'recovery:' || target_reference)
      end
  where id = liability.id
  returning * into liability;

  return query select
    liability.id,
    liability.amount_recovered_pence,
    liability.outstanding_pence,
    liability.status;
end;
$$;

-- One question, one answer: may this provider take another paid booking?
create function ceaute.get_provider_financial_standing(
  target_provider_page_id uuid,
  required_agreement_version text default null
)
returns table (
  out_provider_page_id uuid,
  out_outstanding_pence bigint,
  out_outstanding_count integer,
  out_accepted_agreement_version text,
  out_agreement_accepted_at timestamptz
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  return query
  select
    target_provider_page_id,
    coalesce((
      select sum(provider_liability.outstanding_pence)
      from ceaute.provider_liability
      where provider_liability.provider_page_id = target_provider_page_id
        and provider_liability.status = 'outstanding'
    ), 0)::bigint,
    coalesce((
      select count(*)
      from ceaute.provider_liability
      where provider_liability.provider_page_id = target_provider_page_id
        and provider_liability.status = 'outstanding'
    ), 0)::integer,
    (
      select provider_agreement_acceptance.agreement_version
      from ceaute.provider_agreement_acceptance
      where provider_agreement_acceptance.provider_page_id = target_provider_page_id
        and (
          required_agreement_version is null
          or provider_agreement_acceptance.agreement_version = required_agreement_version
        )
      order by provider_agreement_acceptance.accepted_at desc
      limit 1
    ),
    (
      select provider_agreement_acceptance.accepted_at
      from ceaute.provider_agreement_acceptance
      where provider_agreement_acceptance.provider_page_id = target_provider_page_id
        and (
          required_agreement_version is null
          or provider_agreement_acceptance.agreement_version = required_agreement_version
        )
      order by provider_agreement_acceptance.accepted_at desc
      limit 1
    );
end;
$$;

-- The operator's view of who owes what.
create function ceaute.list_provider_liabilities(
  include_resolved boolean default false,
  max_liabilities integer default 100
)
returns table (
  liability_id uuid,
  provider_page_id uuid,
  provider_username text,
  booking_id uuid,
  stripe_dispute_id text,
  reason text,
  amount_owed_pence bigint,
  amount_recovered_pence bigint,
  outstanding_pence bigint,
  status text,
  note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  return query
  select
    provider_liability.id,
    provider_liability.provider_page_id,
    provider_page.username::text,
    provider_liability.booking_id,
    provider_liability.stripe_dispute_id,
    provider_liability.reason,
    provider_liability.amount_owed_pence,
    provider_liability.amount_recovered_pence,
    provider_liability.outstanding_pence,
    provider_liability.status,
    provider_liability.note,
    provider_liability.created_at,
    provider_liability.resolved_at
  from ceaute.provider_liability
  left join ceaute.provider_page on provider_page.id = provider_liability.provider_page_id
  where include_resolved or provider_liability.status = 'outstanding'
  order by provider_liability.outstanding_pence desc, provider_liability.created_at desc
  limit greatest(1, least(coalesce(max_liabilities, 100), 500));
end;
$$;

revoke all on function ceaute.record_provider_liability(text, bigint, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.record_provider_liability_recovery(uuid, bigint, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.get_provider_financial_standing(uuid, text)
from public, anon, authenticated, service_role;
revoke all on function ceaute.list_provider_liabilities(boolean, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.record_provider_liability(text, bigint, text) to service_role;
grant execute on function ceaute.record_provider_liability_recovery(uuid, bigint, text) to service_role;
grant execute on function ceaute.get_provider_financial_standing(uuid, text) to service_role;
grant execute on function ceaute.list_provider_liabilities(boolean, integer) to service_role;
