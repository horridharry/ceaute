import { legalIdentity } from "@/lib/legal/identity";

// Reading a Stripe dispute event into the shape `record_stripe_dispute` wants.
// Kept as pure functions so the mapping is tested without a webhook, a network
// call or a database — the route below is then only plumbing.
//
// Scope is deliberately narrow: record, notify, and make the booking findable.
// Nothing here reverses a transfer, debits a provider, submits evidence or
// concedes a dispute. See
// docs/reports/2026-09-18-refund-economics-and-provider-liability.md for why
// those are decisions rather than code.

// Every dispute lifecycle event Stripe sends, mapped to the kind the database
// function understands. `updated` is recorded but sends no email: it fires on
// evidence edits and would be noise.
export const DISPUTE_EVENT_KINDS = Object.freeze({
  "charge.dispute.created": "created",
  "charge.dispute.updated": "updated",
  "charge.dispute.closed": "closed",
  "charge.dispute.funds_withdrawn": "funds_withdrawn",
  "charge.dispute.funds_reinstated": "funds_reinstated",
});

export const DISPUTE_EVENT_TYPES = Object.freeze(
  Object.keys(DISPUTE_EVENT_KINDS),
);

// The moments worth waking somebody for. Each maps to its own outbox event
// type, so the existing unique constraint gives exactly one email per moment
// and a replayed Stripe event enqueues nothing.
const NOTIFYING_KINDS = new Set([
  "created",
  "funds_withdrawn",
  "funds_reinstated",
  "closed",
]);

export function isDisputeEventType(eventType) {
  return Object.hasOwn(DISPUTE_EVENT_KINDS, String(eventType ?? ""));
}

export function disputeEventNotifies(eventKind) {
  return NOTIFYING_KINDS.has(String(eventKind ?? ""));
}

function stripeId(value) {
  if (!value) {
    return null;
  }

  return typeof value === "string" ? value : (value.id ?? null);
}

// Stripe sends `evidence_details.due_by` as unix seconds. A missing or absurd
// value becomes null rather than an Invalid Date that PostgreSQL would reject
// and turn into a webhook retry loop.
export function disputeEvidenceDueAt(dispute) {
  const dueBy = Number(dispute?.evidence_details?.due_by);

  if (!Number.isFinite(dueBy) || dueBy <= 0) {
    return null;
  }

  const dueAt = new Date(dueBy * 1000);

  return Number.isNaN(dueAt.getTime()) ? null : dueAt.toISOString();
}

// Where a dispute alert goes. Falls back to the published contact address
// rather than silently not notifying anyone, because a dispute nobody hears
// about is the failure this whole change exists to prevent.
export function resolveOperatorEmail(environment = process.env) {
  const configured = String(environment?.CEAUTE_OPERATOR_EMAIL ?? "").trim();

  return configured || legalIdentity.contactEmail;
}

export function describeDisputeEvent(event, environment = process.env) {
  const eventKind = DISPUTE_EVENT_KINDS[String(event?.type ?? "")];

  if (!eventKind) {
    throw new Error(`Not a Stripe dispute event: ${event?.type}`);
  }

  const dispute = event?.data?.object ?? {};

  if (!dispute.id) {
    throw new Error("Stripe dispute event is missing the dispute id.");
  }

  return {
    eventKind,
    notifies: disputeEventNotifies(eventKind),
    parameters: {
      target_stripe_dispute_id: dispute.id,
      target_stripe_charge_id: stripeId(dispute.charge),
      target_stripe_payment_intent_id: stripeId(dispute.payment_intent),
      // Stripe sends the disputed amount in the smallest currency unit, which
      // is already pence for GBP.
      target_amount_pence: Math.max(0, Math.trunc(Number(dispute.amount) || 0)),
      target_currency: String(dispute.currency ?? "gbp").toLowerCase(),
      target_status: String(dispute.status ?? "unknown"),
      target_reason: dispute.reason ?? null,
      target_evidence_due_at: disputeEvidenceDueAt(dispute),
      target_event_kind: eventKind,
      target_operator_email: resolveOperatorEmail(environment),
    },
  };
}

// How much time is left to respond, for the alert email and the operator list.
// Stripe stops accepting evidence at the deadline, so a negative number means
// the dispute is already lost by default.
export function hoursUntilEvidenceDue(evidenceDueAt, now = Date.now()) {
  if (!evidenceDueAt) {
    return null;
  }

  const dueAt = new Date(evidenceDueAt).getTime();

  if (Number.isNaN(dueAt)) {
    return null;
  }

  return Math.round((dueAt - now) / 3_600_000);
}
