import assert from "node:assert/strict";
import test from "node:test";
import {
  DISPUTE_EVENT_KINDS,
  DISPUTE_EVENT_TYPES,
  describeDisputeEvent,
  disputeEventNotifies,
  disputeEvidenceDueAt,
  hoursUntilEvidenceDue,
  isDisputeEventType,
  resolveOperatorEmail,
} from "../src/lib/payments/disputes.js";
import {
  bookingEmailSubject,
  buildBookingEmailContent,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "../src/lib/emails/booking-email-content.js";

const APP_URL = "https://ceaute.com";
const DUE_BY_SECONDS = Math.floor(Date.UTC(2026, 9, 2, 12, 0, 0) / 1000);

function disputeEvent(type, overrides = {}) {
  return {
    id: "evt_dispute_1",
    type,
    data: {
      object: {
        id: "dp_1",
        object: "dispute",
        amount: 1000,
        currency: "gbp",
        charge: "ch_1",
        payment_intent: "pi_1",
        reason: "product_not_received",
        status: "needs_response",
        evidence_details: { due_by: DUE_BY_SECONDS },
        ...overrides,
      },
    },
  };
}

test("every Stripe dispute lifecycle event is recognised", () => {
  assert.deepEqual(DISPUTE_EVENT_TYPES, [
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
    "charge.dispute.funds_withdrawn",
    "charge.dispute.funds_reinstated",
  ]);

  for (const eventType of DISPUTE_EVENT_TYPES) {
    assert.equal(isDisputeEventType(eventType), true);
  }

  assert.equal(isDisputeEventType("charge.refunded"), false);
  assert.equal(isDisputeEventType(undefined), false);
});

test("only material moments notify; an evidence edit does not", () => {
  assert.equal(disputeEventNotifies("created"), true);
  assert.equal(disputeEventNotifies("funds_withdrawn"), true);
  assert.equal(disputeEventNotifies("funds_reinstated"), true);
  assert.equal(disputeEventNotifies("closed"), true);
  // charge.dispute.updated fires on evidence edits and would be noise.
  assert.equal(disputeEventNotifies("updated"), false);
});

test("a created event maps to the exact parameters the RPC expects", () => {
  const { eventKind, notifies, parameters } = describeDisputeEvent(
    disputeEvent("charge.dispute.created"),
    { CEAUTE_OPERATOR_EMAIL: "ops@ceaute.test" },
  );

  assert.equal(eventKind, "created");
  assert.equal(notifies, true);
  assert.deepEqual(parameters, {
    target_stripe_dispute_id: "dp_1",
    target_stripe_charge_id: "ch_1",
    target_stripe_payment_intent_id: "pi_1",
    target_amount_pence: 1000,
    target_currency: "gbp",
    target_status: "needs_response",
    target_reason: "product_not_received",
    target_evidence_due_at: new Date(DUE_BY_SECONDS * 1000).toISOString(),
    target_event_kind: "created",
    target_operator_email: "ops@ceaute.test",
  });
});

test("expanded charge and payment intent objects are reduced to their ids", () => {
  const { parameters } = describeDisputeEvent(
    disputeEvent("charge.dispute.closed", {
      charge: { id: "ch_expanded", object: "charge" },
      payment_intent: { id: "pi_expanded", object: "payment_intent" },
    }),
  );

  assert.equal(parameters.target_stripe_charge_id, "ch_expanded");
  assert.equal(parameters.target_stripe_payment_intent_id, "pi_expanded");
  assert.equal(parameters.target_event_kind, "closed");
});

test("each event type maps to its own kind so replays stay idempotent", () => {
  for (const [eventType, expectedKind] of Object.entries(DISPUTE_EVENT_KINDS)) {
    const first = describeDisputeEvent(disputeEvent(eventType));
    const replay = describeDisputeEvent(disputeEvent(eventType));

    assert.equal(first.eventKind, expectedKind);
    // The same event produces byte-identical parameters, so a redelivery
    // rewrites the same row rather than creating a second dispute.
    assert.deepEqual(first.parameters, replay.parameters);
  }
});

test("a missing or nonsensical evidence deadline becomes null, not an error", () => {
  for (const evidence_details of [
    undefined,
    {},
    { due_by: null },
    { due_by: 0 },
    { due_by: -1 },
    { due_by: "soon" },
  ]) {
    assert.equal(disputeEvidenceDueAt({ evidence_details }), null);
  }
});

test("a dispute missing its own id is rejected rather than half-recorded", () => {
  assert.throws(
    () => describeDisputeEvent(disputeEvent("charge.dispute.created", { id: null })),
    /missing the dispute id/,
  );
});

test("a non-dispute event is refused outright", () => {
  assert.throws(
    () => describeDisputeEvent({ type: "checkout.session.completed", data: { object: {} } }),
    /Not a Stripe dispute event/,
  );
});

test("a dispute with no linkable payment intent still yields recordable parameters", () => {
  // It must land in the table so the operator list shows it; an unmatched
  // dispute is the case that most needs a human.
  const { parameters } = describeDisputeEvent(
    disputeEvent("charge.dispute.created", { payment_intent: null, charge: null }),
  );

  assert.equal(parameters.target_stripe_payment_intent_id, null);
  assert.equal(parameters.target_stripe_charge_id, null);
  assert.equal(parameters.target_stripe_dispute_id, "dp_1");
});

test("amounts and currency are normalised the way the column expects", () => {
  const { parameters } = describeDisputeEvent(
    disputeEvent("charge.dispute.created", {
      amount: 1234.7,
      currency: "GBP",
      status: undefined,
      reason: undefined,
    }),
  );

  assert.equal(parameters.target_amount_pence, 1234);
  assert.equal(parameters.target_currency, "gbp");
  assert.equal(parameters.target_status, "unknown");
  assert.equal(parameters.target_reason, null);
});

test("a negative amount cannot slip past the non-negative check", () => {
  const { parameters } = describeDisputeEvent(
    disputeEvent("charge.dispute.created", { amount: -500 }),
  );

  assert.equal(parameters.target_amount_pence, 0);
});

test("the operator address falls back to the published contact, never to nobody", () => {
  assert.equal(
    resolveOperatorEmail({ CEAUTE_OPERATOR_EMAIL: "ops@ceaute.test" }),
    "ops@ceaute.test",
  );

  for (const environment of [{}, { CEAUTE_OPERATOR_EMAIL: "" }, { CEAUTE_OPERATOR_EMAIL: "   " }]) {
    assert.equal(resolveOperatorEmail(environment), "ndu.harry02@gmail.com");
  }
});

test("time remaining counts down and goes negative once the deadline passes", () => {
  const dueAt = "2026-10-02T12:00:00.000Z";

  assert.equal(
    hoursUntilEvidenceDue(dueAt, Date.parse("2026-10-01T12:00:00.000Z")),
    24,
  );
  assert.equal(
    hoursUntilEvidenceDue(dueAt, Date.parse("2026-10-02T18:00:00.000Z")),
    -6,
  );
  assert.equal(hoursUntilEvidenceDue(null), null);
  assert.equal(hoursUntilEvidenceDue("not a date"), null);
});

// --- the operator alert email ------------------------------------------------

function disputeEmail(eventType) {
  return {
    event_type: eventType,
    recipient_role: "operator",
    payload: {
      stripe_dispute_id: "dp_1",
      dispute_status: "needs_response",
      dispute_reason: "product_not_received",
      dispute_amount_pence: 1000,
      evidence_due_at: "2026-10-02T12:00:00.000Z",
      stripe_payment_intent_id: "pi_1",
      booking_id: "11111111-2222-3333-4444-555555555555",
      provider_name: "Glow Studio",
      provider_username: "glowstudio",
      treatment_name: "Full set",
      start_at: "2026-10-01T09:00:00.000Z",
    },
  };
}

test("the alert carries the dispute facts and the response deadline", () => {
  const email = disputeEmail("dispute_opened_operator");
  const content = buildBookingEmailContent(email, APP_URL);
  const text = renderBookingEmailText(email, APP_URL);

  assert.equal(bookingEmailSubject(email), "Action needed: a payment was disputed");
  assert.equal(content.badge, "Payment dispute");
  assert.match(text, /Status: needs_response/);
  assert.match(text, /Amount: £10\.00/);
  assert.match(text, /Stripe dispute: dp_1/);
  assert.match(text, /Respond by: .*2 Oct/);
  assert.match(text, /Treatment: Full set/);
});

test("the alert never carries the provider's private address", () => {
  // The confirmation branch includes it; the dispute branch must not, and this
  // asserts the two cannot be confused.
  const email = {
    ...disputeEmail("dispute_opened_operator"),
    payload: {
      ...disputeEmail("dispute_opened_operator").payload,
      address_line_1: "12 Private Street",
      postcode: "E1 6AN",
      access_instructions: "Ring the top bell",
    },
  };
  const text = renderBookingEmailText(email, APP_URL);
  const html = renderBookingEmailHtml(email, APP_URL);

  for (const alternative of [text, html]) {
    assert.doesNotMatch(alternative, /12 Private Street/);
    assert.doesNotMatch(alternative, /E1 6AN/);
    assert.doesNotMatch(alternative, /Ring the top bell/);
  }
});

test("every notifying moment has its own subject, so none silently reuses another", () => {
  const subjects = [
    "dispute_opened_operator",
    "dispute_funds_withdrawn_operator",
    "dispute_funds_reinstated_operator",
    "dispute_closed_operator",
  ].map((eventType) => bookingEmailSubject(disputeEmail(eventType)));

  assert.equal(new Set(subjects).size, subjects.length);
  assert.ok(subjects.every((subject) => subject !== "Ceaute booking update"));
});

test("a dispute with no deadline says so rather than rendering an invalid date", () => {
  const email = disputeEmail("dispute_closed_operator");
  email.payload.evidence_due_at = null;

  const text = renderBookingEmailText(email, APP_URL);

  assert.match(text, /Respond by: Not set by Stripe/);
  assert.doesNotMatch(text, /Invalid Date/);
});
