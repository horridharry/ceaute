-- Minimum dispute handling: record what Stripe tells us, tell the operator, and
-- make affected bookings findable. Nothing here reverses a transfer, debits a
-- provider, submits evidence or accepts liability — those are decisions nobody
-- has made (see docs/reports/2026-09-18-refund-economics-and-provider-liability.md).
--
-- Idempotency comes from two places that already exist in this design: the
-- stripe_payment_event ledger claims each Stripe event id once, and the upsert
-- below is keyed on the dispute id, so a replayed event rewrites the same row
-- rather than creating a second one.

create table ceaute.booking_dispute (
  id uuid primary key default gen_random_uuid(),
  stripe_dispute_id text not null unique,
  -- Nullable on purpose. A dispute we cannot map back to a booking still has to
  -- be recorded and surfaced, because that is exactly the case somebody needs
  -- to look at by hand.
  booking_id uuid references ceaute.booking (id) on delete restrict,
  booking_payment_attempt_id uuid references ceaute.booking_payment_attempt (id) on delete restrict,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_pence bigint not null check (amount_pence >= 0),
  currency text not null default 'gbp' check (currency = 'gbp'),
  -- Deliberately unconstrained text. Stripe's dispute statuses have changed
  -- before and a CHECK here would turn a new value into a webhook that 500s
  -- forever instead of a row somebody can read.
  status text not null,
  reason text,
  evidence_due_at timestamptz,
  funds_withdrawn_at timestamptz,
  funds_reinstated_at timestamptz,
  closed_at timestamptz,
  opened_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index booking_dispute_booking_idx
  on ceaute.booking_dispute (booking_id);
create index booking_dispute_open_idx
  on ceaute.booking_dispute (closed_at, last_event_at desc);

create trigger booking_dispute_set_updated_at
before update on ceaute.booking_dispute
for each row execute function ceaute.set_updated_at();

alter table ceaute.booking_dispute enable row level security;

-- No policies: disputes are operator-only. Customers must not learn that a
-- dispute exists from the product, and providers must not either while the
-- liability question is open.
revoke all on ceaute.booking_dispute from anon, authenticated;
grant select, insert, update on ceaute.booking_dispute to service_role;

-- The outbox already carries delivery, retry and claim machinery. Reuse it
-- rather than inventing a second notification path: these two CHECK lists are
-- the whole change.
alter table ceaute.booking_email_outbox
  drop constraint booking_email_outbox_event_type_check;

alter table ceaute.booking_email_outbox
  add constraint booking_email_outbox_event_type_check check (
    event_type in (
      'booking_confirmed_customer',
      'booking_confirmed_provider',
      'customer_cancelled_customer',
      'customer_cancelled_provider',
      'provider_cancelled_customer',
      'provider_cancelled_provider',
      'dispute_opened_operator',
      'dispute_funds_withdrawn_operator',
      'dispute_funds_reinstated_operator',
      'dispute_closed_operator'
    )
  );

alter table ceaute.booking_email_outbox
  drop constraint booking_email_outbox_recipient_role_check;

alter table ceaute.booking_email_outbox
  add constraint booking_email_outbox_recipient_role_check check (
    recipient_role in ('customer', 'provider', 'operator')
  );

-- Each material moment in a dispute maps to its own event type, so the existing
-- unique (booking_id, event_type, recipient_email) gives one email per moment
-- and a replay inserts nothing. `charge.dispute.updated` is recorded but sends
-- nothing: it fires for evidence edits and would be noise.
create function ceaute.record_stripe_dispute(
  target_stripe_dispute_id text,
  target_stripe_charge_id text,
  target_stripe_payment_intent_id text,
  target_amount_pence bigint,
  target_currency text,
  target_status text,
  target_reason text,
  target_evidence_due_at timestamptz,
  target_event_kind text,
  target_operator_email text
)
returns table (
  out_dispute_id uuid,
  out_booking_id uuid,
  out_status text,
  out_emails_enqueued integer
)
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  payment_attempt ceaute.booking_payment_attempt%rowtype;
  target_booking ceaute.booking%rowtype;
  dispute ceaute.booking_dispute%rowtype;
  provider_page ceaute.provider_page%rowtype;
  notification_event_type text;
  enqueued_count integer := 0;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'Trusted backend access required.';
  end if;

  if nullif(btrim(target_stripe_dispute_id), '') is null then
    raise exception 'Stripe dispute identity is required.';
  end if;

  if target_event_kind not in (
    'created', 'updated', 'closed', 'funds_withdrawn', 'funds_reinstated'
  ) then
    raise exception 'Unknown dispute event kind: %', target_event_kind;
  end if;

  select * into payment_attempt
  from ceaute.booking_payment_attempt
  where stripe_payment_intent_id = nullif(btrim(target_stripe_payment_intent_id), '')
  limit 1;

  if payment_attempt.id is not null then
    select * into target_booking
    from ceaute.booking
    where id = payment_attempt.booking_id;
  end if;

  insert into ceaute.booking_dispute (
    stripe_dispute_id,
    booking_id,
    booking_payment_attempt_id,
    stripe_charge_id,
    stripe_payment_intent_id,
    amount_pence,
    currency,
    status,
    reason,
    evidence_due_at,
    funds_withdrawn_at,
    funds_reinstated_at,
    closed_at,
    last_event_at
  ) values (
    target_stripe_dispute_id,
    target_booking.id,
    payment_attempt.id,
    nullif(btrim(target_stripe_charge_id), ''),
    nullif(btrim(target_stripe_payment_intent_id), ''),
    greatest(0, coalesce(target_amount_pence, 0)),
    lower(coalesce(nullif(btrim(target_currency), ''), 'gbp')),
    target_status,
    nullif(btrim(target_reason), ''),
    target_evidence_due_at,
    case when target_event_kind = 'funds_withdrawn' then now() end,
    case when target_event_kind = 'funds_reinstated' then now() end,
    case when target_event_kind = 'closed' then now() end,
    now()
  )
  on conflict (stripe_dispute_id) do update set
    -- Resolve the booking if a later event carries what the first one lacked,
    -- but never unset it.
    booking_id = coalesce(booking_dispute.booking_id, excluded.booking_id),
    booking_payment_attempt_id = coalesce(
      booking_dispute.booking_payment_attempt_id,
      excluded.booking_payment_attempt_id
    ),
    stripe_charge_id = coalesce(excluded.stripe_charge_id, booking_dispute.stripe_charge_id),
    amount_pence = excluded.amount_pence,
    status = excluded.status,
    reason = coalesce(excluded.reason, booking_dispute.reason),
    evidence_due_at = coalesce(excluded.evidence_due_at, booking_dispute.evidence_due_at),
    -- These three are set once. A replayed event must not move the timestamp.
    funds_withdrawn_at = coalesce(
      booking_dispute.funds_withdrawn_at, excluded.funds_withdrawn_at
    ),
    funds_reinstated_at = coalesce(
      booking_dispute.funds_reinstated_at, excluded.funds_reinstated_at
    ),
    closed_at = coalesce(booking_dispute.closed_at, excluded.closed_at),
    last_event_at = now()
  returning * into dispute;

  notification_event_type := case target_event_kind
    when 'created' then 'dispute_opened_operator'
    when 'funds_withdrawn' then 'dispute_funds_withdrawn_operator'
    when 'funds_reinstated' then 'dispute_funds_reinstated_operator'
    when 'closed' then 'dispute_closed_operator'
  end;

  if notification_event_type is not null
    and dispute.booking_id is not null
    and nullif(btrim(target_operator_email), '') is not null then

    select * into target_booking from ceaute.booking where id = dispute.booking_id;
    select * into provider_page
    from ceaute.provider_page
    where id = target_booking.provider_page_id;

    insert into ceaute.booking_email_outbox (
      event_type,
      booking_id,
      recipient_email,
      recipient_role,
      payload
    ) values (
      notification_event_type,
      dispute.booking_id,
      btrim(target_operator_email),
      'operator',
      jsonb_build_object(
        'stripe_dispute_id', dispute.stripe_dispute_id,
        'dispute_status', dispute.status,
        'dispute_reason', dispute.reason,
        'dispute_amount_pence', dispute.amount_pence,
        'evidence_due_at', dispute.evidence_due_at,
        'stripe_payment_intent_id', dispute.stripe_payment_intent_id,
        'booking_id', dispute.booking_id,
        'provider_name', coalesce(provider_page.display_name, 'Unknown provider'),
        'provider_username', provider_page.username,
        'treatment_name', target_booking.service_snapshot ->> 'treatment_name',
        'start_at', target_booking.start_at,
        'amount_paid_pence', target_booking.service_snapshot ->> 'total_price_pence'
      )
    )
    on conflict (booking_id, event_type, recipient_email) do nothing;

    get diagnostics enqueued_count = row_count;
  end if;

  return query select dispute.id, dispute.booking_id, dispute.status, enqueued_count;
end;
$$;

-- The operator's read. Narrow on purpose: enough to find the booking and judge
-- urgency, without customer contact details.
create function ceaute.list_booking_disputes(
  include_closed boolean default false,
  max_disputes integer default 100
)
returns table (
  stripe_dispute_id text,
  booking_id uuid,
  status text,
  reason text,
  amount_pence bigint,
  currency text,
  evidence_due_at timestamptz,
  funds_withdrawn_at timestamptz,
  funds_reinstated_at timestamptz,
  closed_at timestamptz,
  opened_at timestamptz,
  last_event_at timestamptz,
  stripe_payment_intent_id text,
  provider_username text,
  treatment_name text,
  appointment_at timestamptz
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
    booking_dispute.stripe_dispute_id,
    booking_dispute.booking_id,
    booking_dispute.status,
    booking_dispute.reason,
    booking_dispute.amount_pence,
    booking_dispute.currency,
    booking_dispute.evidence_due_at,
    booking_dispute.funds_withdrawn_at,
    booking_dispute.funds_reinstated_at,
    booking_dispute.closed_at,
    booking_dispute.opened_at,
    booking_dispute.last_event_at,
    booking_dispute.stripe_payment_intent_id,
    -- provider_page.username is varchar(30); RETURN QUERY rejects the row
    -- outright unless it matches the declared text column exactly.
    provider_page.username::text,
    booking.service_snapshot ->> 'treatment_name',
    booking.start_at
  from ceaute.booking_dispute
  left join ceaute.booking on booking.id = booking_dispute.booking_id
  left join ceaute.provider_page on provider_page.id = booking.provider_page_id
  where include_closed or booking_dispute.closed_at is null
  order by booking_dispute.evidence_due_at nulls last, booking_dispute.last_event_at desc
  limit greatest(1, least(coalesce(max_disputes, 100), 500));
end;
$$;

revoke all on function ceaute.record_stripe_dispute(
  text, text, text, bigint, text, text, text, timestamptz, text, text
) from public, anon, authenticated, service_role;
revoke all on function ceaute.list_booking_disputes(boolean, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.record_stripe_dispute(
  text, text, text, bigint, text, text, text, timestamptz, text, text
) to service_role;
grant execute on function ceaute.list_booking_disputes(boolean, integer) to service_role;
