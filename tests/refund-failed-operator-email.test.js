import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingEmailSubject,
  buildBookingEmailContent,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "../src/lib/emails/booking-email-content.js";
import { recordBookingRefundState } from "../src/lib/payments/refunds.js";

const APP_URL = "https://ceaute.example.test";

// The payload record_booking_refund_state queues when Stripe fails a refund.
function refundFailedEmail(payloadOverrides = {}) {
  return {
    id: "email-1",
    event_type: "refund_failed_operator",
    recipient_role: "operator",
    payload: {
      booking_id: "11111111-2222-3333-4444-555555555555",
      refund_purpose: "cancellation",
      refund_status: "failed",
      refund_amount_pence: 1500,
      failure_reason: "expired_or_canceled_card",
      reported_success_first: true,
      stripe_refund_id: "re_1",
      stripe_payment_intent_id: "pi_1",
      provider_name: "Glow Studio",
      provider_username: "glowstudio",
      treatment_name: "Full set",
      start_at: "2026-10-01T09:00:00.000Z",
      cancelled_by: "provider",
      ...payloadOverrides,
    },
  };
}

test("the refund-failed alert says what is owed, why, and that a person must act", () => {
  const email = refundFailedEmail();
  const content = buildBookingEmailContent(email, APP_URL);
  const text = renderBookingEmailText(email, APP_URL);

  assert.equal(bookingEmailSubject(email), "Action needed: a refund didn’t reach the customer");
  assert.equal(content.badge, "Refund failed");
  assert.match(text, /Pay the customer another way/);
  assert.match(text, /Ceaute has not emailed them/);
  assert.match(text, /Amount owed to the customer: £15\.00/);
  assert.match(text, /Stripe’s reason: expired_or_canceled_card/);
  assert.match(text, /Reported as refunded first: Yes/);
  assert.match(text, /Stripe refund: re_1/);
  assert.match(text, /Stripe payment: pi_1/);
  assert.match(text, /Treatment: Full set/);
});

test("the refund-failed alert carries no address, no customer contact and no booking link", () => {
  const email = refundFailedEmail({
    address_line_1: "12 Private Street",
    postcode: "E1 6AN",
    customer_email: "customer@example.test",
    customer_phone: "+447700900123",
  });
  const text = renderBookingEmailText(email, APP_URL);
  const html = renderBookingEmailHtml(email, APP_URL);

  for (const alternative of [text, html]) {
    assert.doesNotMatch(alternative, /12 Private Street/);
    assert.doesNotMatch(alternative, /E1 6AN/);
    assert.doesNotMatch(alternative, /customer@example\.test/);
    assert.doesNotMatch(alternative, /\+447700900123/);
    assert.doesNotMatch(alternative, /\/dashboard\/bookings\//);
  }
});

test("recording a Stripe refund passes the operator address to PostgreSQL", async () => {
  const calls = [];
  const supabase = {
    schema: () => ({
      async rpc(functionName, parameters) {
        calls.push({ functionName, parameters });
        return { data: null, error: null };
      },
    }),
  };
  const previous = process.env.CEAUTE_OPERATOR_EMAIL;
  process.env.CEAUTE_OPERATOR_EMAIL = "operator@example.test";

  try {
    await recordBookingRefundState({
      refundOperationId: "refund-op-1",
      refund: {
        id: "re_1",
        payment_intent: "pi_1",
        charge: "ch_1",
        amount: 1500,
        status: "failed",
        failure_reason: "expired_or_canceled_card",
      },
      eventCreatedAt: 300,
      supabase,
    });
  } finally {
    if (previous === undefined) delete process.env.CEAUTE_OPERATOR_EMAIL;
    else process.env.CEAUTE_OPERATOR_EMAIL = previous;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].functionName, "record_booking_refund_state");
  assert.equal(calls[0].parameters.target_status, "failed");
  assert.equal(calls[0].parameters.target_event_created_at, 300);
  assert.equal(calls[0].parameters.target_operator_email, "operator@example.test");
});
