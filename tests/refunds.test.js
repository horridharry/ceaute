import assert from "node:assert/strict";
import test from "node:test";
import { processBookingRefund } from "../src/lib/payments/refunds.js";

// A claimed refund operation as returned by claim_booking_refund_operation.
function operation(overrides = {}) {
  return {
    action: "create",
    refund_operation_id: "refund-op-1",
    refund_status: "requested",
    stripe_refund_id: null,
    stripe_payment_intent_id: "pi_test",
    expected_amount_pence: 2500,
    captured_amount_pence: 5000,
    purpose: "cancellation",
    ceaute_fee_pence: 0,
    booking_id: "booking-1",
    payment_attempt_id: "attempt-1",
    idempotency_key: "ceaute-refund-op-1",
    ...overrides,
  };
}

function fakeSupabase(claimRow) {
  const calls = [];

  return {
    calls,
    schema(name) {
      assert.equal(name, "ceaute");
      return {
        async rpc(functionName, parameters) {
          calls.push({ functionName, parameters });

          if (functionName === "claim_booking_refund_operation") {
            return { data: [claimRow], error: null };
          }

          return { data: null, error: null };
        },
      };
    },
  };
}

function stripeRefund(overrides = {}) {
  return {
    id: "re_created",
    status: "pending",
    amount: 2500,
    payment_intent: "pi_test",
    charge: "ch_test",
    failure_reason: null,
    metadata: { refund_operation_id: "refund-op-1" },
    ...overrides,
  };
}

function fakeStripe({ create, retrieve, list } = {}) {
  const calls = [];

  return {
    calls,
    refunds: {
      async create(parameters, options) {
        calls.push({ method: "create", parameters, options });
        if (!create) throw new Error("create was not expected");
        return create(parameters, options);
      },
      async retrieve(id) {
        calls.push({ method: "retrieve", id });
        if (!retrieve) throw new Error("retrieve was not expected");
        return retrieve(id);
      },
      async list(parameters) {
        calls.push({ method: "list", parameters });
        if (!list) throw new Error("list was not expected");
        return list(parameters);
      },
    },
  };
}

function definitiveStripeError(message) {
  const error = new Error(message);
  error.type = "StripeInvalidRequestError";
  return error;
}

test("a newly claimed refund is created once with its persisted idempotency key and recorded", async () => {
  const supabase = fakeSupabase(operation());
  const stripe = fakeStripe({ create: () => stripeRefund() });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, {
    action: "create",
    status: "pending",
    stripeRefundId: "re_created",
    applicationFeeSettled: false,
    applicationFeeRefundPence: 0,
  });
  assert.equal(stripe.calls.length, 1);
  assert.equal(stripe.calls[0].method, "create");
  assert.equal(stripe.calls[0].parameters.amount, 2500);
  assert.equal(stripe.calls[0].parameters.payment_intent, "pi_test");
  assert.equal(stripe.calls[0].parameters.reverse_transfer, true);
  assert.equal(stripe.calls[0].options.idempotencyKey, "ceaute-refund-op-1");
  assert.deepEqual(
    supabase.calls.map((call) => call.functionName),
    [
    "claim_booking_refund_operation",
    "record_booking_refund_state",
    // Refunding the customer is followed by settling Ceaute's own fee.
    "get_booking_refund_settlement_inputs",
  ],
  );
  assert.equal(supabase.calls[1].parameters.target_refund_operation_id, "refund-op-1");
  assert.equal(supabase.calls[1].parameters.target_stripe_refund_id, "re_created");
  assert.equal(supabase.calls[1].parameters.target_amount_pence, 2500);
  assert.equal(supabase.calls[1].parameters.target_status, "pending");
});

test("an operation that already has a Stripe refund is retrieved, never created a second time", async () => {
  const supabase = fakeSupabase(operation({ action: "retry", stripe_refund_id: "re_existing" }));
  const stripe = fakeStripe({
    retrieve: (id) => stripeRefund({ id, status: "succeeded" }),
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, {
    action: "retry",
    status: "succeeded",
    stripeRefundId: "re_existing",
    applicationFeeSettled: false,
    applicationFeeRefundPence: 0,
  });
  assert.deepEqual(stripe.calls.map((call) => call.method), ["retrieve"]);
});

for (const action of ["complete", "processing", "requires_review"]) {
  test(`a claim answering "${action}" returns the recorded state without touching Stripe`, async () => {
    const supabase = fakeSupabase(
      operation({ action, refund_status: "succeeded", stripe_refund_id: "re_done" }),
    );
    const stripe = fakeStripe();

    const result = await processBookingRefund("refund-op-1", { stripe, supabase });

    // A terminal claim returns before any Stripe call, so no settlement is
    // attempted and the result keeps its original shape.
    assert.deepEqual(result, { action, status: "succeeded", stripeRefundId: "re_done" });
    assert.equal(stripe.calls.length, 0);
    assert.deepEqual(supabase.calls.map((call) => call.functionName), ["claim_booking_refund_operation"]);
  });
}

test("a definitive Stripe rejection is recorded as failed without reconciliation", async () => {
  const supabase = fakeSupabase(operation());
  const stripe = fakeStripe({
    create: () => {
      throw definitiveStripeError("Charge has already been refunded.");
    },
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, { action: "failed", status: "failed", stripeRefundId: null });
  assert.deepEqual(stripe.calls.map((call) => call.method), ["create"]);
  assert.deepEqual(supabase.calls[1], {
    functionName: "record_booking_refund_processing_outcome",
    parameters: {
      target_refund_operation_id: "refund-op-1",
      target_outcome: "failed",
      target_failure_reason: "Charge has already been refunded.",
    },
  });
});

test("an unknown network outcome is reconciled against Stripe and adopted when the refund exists", async () => {
  const supabase = fakeSupabase(operation());
  const stripe = fakeStripe({
    create: () => {
      throw new Error("ETIMEDOUT");
    },
    list: () => ({ has_more: false, data: [stripeRefund({ id: "re_lost", status: "succeeded" })] }),
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, { action: "reconciled", status: "succeeded", stripeRefundId: "re_lost" });
  assert.deepEqual(stripe.calls.map((call) => call.method), ["create", "list"]);
  assert.equal(stripe.calls[1].parameters.payment_intent, "pi_test");
  assert.equal(supabase.calls[1].functionName, "record_booking_refund_state");
  assert.equal(supabase.calls[1].parameters.target_stripe_refund_id, "re_lost");
});

test("an unknown network outcome with no matching Stripe refund stays pending for a same-key retry", async () => {
  const supabase = fakeSupabase(operation());
  const stripe = fakeStripe({
    create: () => {
      throw new Error("ECONNRESET");
    },
    list: () => ({ has_more: false, data: [] }),
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, { action: "pending", status: "pending", stripeRefundId: null });
  assert.deepEqual(supabase.calls[1], {
    functionName: "record_booking_refund_processing_outcome",
    parameters: {
      target_refund_operation_id: "refund-op-1",
      target_outcome: "pending",
      target_failure_reason: "ECONNRESET",
    },
  });
});

test("a retry that must verify first adopts the earlier refund instead of creating another", async () => {
  const supabase = fakeSupabase(operation({ action: "verify_before_retry" }));
  const stripe = fakeStripe({
    list: () => ({ has_more: false, data: [stripeRefund({ id: "re_earlier" })] }),
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, { action: "reconciled", status: "pending", stripeRefundId: "re_earlier" });
  assert.deepEqual(stripe.calls.map((call) => call.method), ["list"]);
});

test("a retry whose Stripe history is ambiguous is parked for manual review rather than refunded again", async () => {
  const supabase = fakeSupabase(operation({ action: "verify_before_retry" }));
  const stripe = fakeStripe({
    list: () => ({
      has_more: false,
      data: [stripeRefund({ id: "re_a" }), stripeRefund({ id: "re_b" })],
    }),
  });

  const result = await processBookingRefund("refund-op-1", { stripe, supabase });

  assert.deepEqual(result, { action: "requires_review", status: "requires_review", stripeRefundId: null });
  assert.deepEqual(stripe.calls.map((call) => call.method), ["list"]);
  assert.equal(supabase.calls[1].functionName, "record_booking_refund_processing_outcome");
  assert.equal(supabase.calls[1].parameters.target_outcome, "requires_review");
});
