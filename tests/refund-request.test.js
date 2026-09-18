import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStripeRefundRequest,
  classifyRefundReconciliation,
} from "../src/lib/payments/refund-request.js";

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
  assert.equal(request.options.idempotencyKey, "ceaute-refund-integrity");
  assert.equal(request.parameters.amount, 2500);
});

test("never lets Stripe decide how much of the application fee comes back", () => {
  // The boolean can only return all of the fee or none of it. Three of the
  // four settlement causes need a share, so the refund always says false and
  // settleApplicationFee refunds the exact amount the canonical rules decide.
  for (const ceaute_fee_pence of [0, 250]) {
    const request = buildStripeRefundRequest(operation({ ceaute_fee_pence }));

    assert.equal(request.parameters.reverse_transfer, true);
    assert.equal(request.parameters.refund_application_fee, false);
  }
});

test("uses Stripe's duplicate reason for duplicate-payment recovery", () => {
  const request = buildStripeRefundRequest(
    operation({ purpose: "duplicate_payment" }),
  );

  assert.equal(request.parameters.reason, "duplicate");
  assert.equal(request.parameters.metadata.purpose, "duplicate_payment");
});

test("reconciles a lost refund response by durable operation identity", () => {
  const expected = operation({ captured_amount_pence: 5000 });
  const refund = {
    id: "re_lost_response",
    amount: 2500,
    status: "succeeded",
    payment_intent: "pi_integrity",
    metadata: { refund_operation_id: "refund-integrity" },
  };

  assert.deepEqual(
    classifyRefundReconciliation(expected, { data: [refund], has_more: false }),
    { action: "matched", refund },
  );
});

test("ambiguous or over-entitled refund reconciliation requires review", () => {
  const expected = operation({ captured_amount_pence: 5000 });
  const conflicting = {
    id: "re_wrong_amount",
    amount: 2400,
    status: "pending",
    payment_intent: "pi_integrity",
    metadata: { refund_operation_id: "refund-integrity" },
  };

  assert.equal(
    classifyRefundReconciliation(expected, {
      data: [conflicting],
      has_more: false,
    }).action,
    "requires_review",
  );
  assert.equal(
    classifyRefundReconciliation(expected, {
      data: [
        {
          id: "re_other",
          amount: 3000,
          status: "succeeded",
          payment_intent: "pi_integrity",
          metadata: {},
        },
      ],
      has_more: false,
    }).action,
    "requires_review",
  );
});
