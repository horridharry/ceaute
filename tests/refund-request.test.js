import assert from "node:assert/strict";
import test from "node:test";
import { buildStripeRefundRequest } from "../src/lib/payments/refund-request.js";

function operation(overrides = {}) {
  return {
    stripe_payment_intent_id: "pi_integrity",
    expected_amount_pence: 2500,
    purpose: "cancellation",
    ceaute_fee_pence: 0,
    booking_id: "booking-integrity",
    payment_attempt_id: "attempt-integrity",
    refund_operation_id: "refund-integrity",
    idempotency_key: "ceaute-refund-integrity",
    ...overrides,
  };
}

test("builds a transfer-reversing refund with a stable operation key", () => {
  const request = buildStripeRefundRequest(operation());

  assert.equal(request.parameters.reverse_transfer, true);
  assert.equal(request.parameters.refund_application_fee, undefined);
  assert.equal(request.options.idempotencyKey, "ceaute-refund-integrity");
  assert.equal(request.parameters.amount, 2500);
});

test("refunds the application fee only when the captured fee is positive", () => {
  const request = buildStripeRefundRequest(operation({ ceaute_fee_pence: 250 }));

  assert.equal(request.parameters.reverse_transfer, true);
  assert.equal(request.parameters.refund_application_fee, true);
});

test("uses Stripe's duplicate reason for duplicate-payment recovery", () => {
  const request = buildStripeRefundRequest(
    operation({ purpose: "duplicate_payment" }),
  );

  assert.equal(request.parameters.reason, "duplicate");
  assert.equal(request.parameters.metadata.purpose, "duplicate_payment");
});
