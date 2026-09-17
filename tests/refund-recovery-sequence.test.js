import assert from "node:assert/strict";
import test from "node:test";
import { recoverStuckBookingRefunds } from "../src/lib/payments/refund-recovery.js";
import { processBookingRefund } from "../src/lib/payments/refunds.js";

// These tests run the real refund processor behind the real recovery pass.
// The fake database follows the decisions claim_booking_refund_operation makes
// (create, verify_before_retry, reconcile, complete) and the fake Stripe
// honours idempotency keys, so a duplicate refund would show up as a second
// refund object or a second key. The SQL side of the same guarantees is in
// supabase/tests/database/refund_recovery.test.sql.
function statefulRefundBackend({ createAttemptedBefore = false } = {}) {
  const row = {
    id: "refund-op-1",
    status: createAttemptedBefore ? "pending" : "requested",
    create_attempted: createAttemptedBefore,
    stripe_refund_id: null,
  };
  const claimedActions = [];

  function claim() {
    let action;

    if (["succeeded", "failed", "cancelled", "requires_review"].includes(row.status)) {
      action = "complete";
    } else if (row.stripe_refund_id) {
      action = "reconcile";
    } else if (row.create_attempted) {
      action = "verify_before_retry";
    } else {
      action = "create";
    }

    if (action !== "complete") {
      row.status = "processing";
      row.create_attempted = true;
    }

    claimedActions.push(action);

    return {
      action,
      refund_operation_id: row.id,
      refund_status: row.status,
      stripe_refund_id: row.stripe_refund_id,
      stripe_payment_intent_id: "pi_test",
      expected_amount_pence: 1500,
      captured_amount_pence: 1500,
      purpose: "cancellation",
      ceaute_fee_pence: 0,
      booking_id: "booking-1",
      payment_attempt_id: "attempt-1",
      idempotency_key: "ceaute-refund-op-1",
    };
  }

  const supabase = {
    schema() {
      return {
        async rpc(functionName, parameters) {
          if (functionName === "list_retryable_booking_refund_operations") {
            const retryable = ["requested", "pending", "processing"].includes(row.status);
            return {
              data: retryable
                ? [{ refund_operation_id: row.id, refund_status: row.status }]
                : [],
              error: null,
            };
          }

          if (functionName === "claim_booking_refund_operation") {
            return { data: [claim()], error: null };
          }

          if (functionName === "record_booking_refund_state") {
            row.stripe_refund_id = parameters.target_stripe_refund_id;
            row.status = parameters.target_status === "succeeded" ? "succeeded" : "pending";
            return { data: null, error: null };
          }

          if (functionName === "record_booking_refund_processing_outcome") {
            row.status = parameters.target_outcome;
            return { data: null, error: null };
          }

          throw new Error(`Unexpected rpc ${functionName}`);
        },
      };
    },
  };

  return { row, claimedActions, supabase };
}

function idempotentStripe({ failCreateTimes = 0, loseFirstResponse = false } = {}) {
  const refundsByKey = new Map();
  const createKeys = [];
  let remainingFailures = failCreateTimes;
  let responseLost = false;

  return {
    refundsByKey,
    createKeys,
    refunds: {
      async create(parameters, options) {
        createKeys.push(options.idempotencyKey);

        if (remainingFailures > 0) {
          remainingFailures -= 1;
          throw new Error("An error occurred with our connection to Stripe.");
        }

        if (!refundsByKey.has(options.idempotencyKey)) {
          refundsByKey.set(options.idempotencyKey, {
            id: `re_${refundsByKey.size + 1}`,
            status: "succeeded",
            amount: parameters.amount,
            payment_intent: parameters.payment_intent,
            charge: "ch_test",
            failure_reason: null,
            metadata: parameters.metadata,
          });
        }

        if (loseFirstResponse && !responseLost) {
          responseLost = true;
          throw new Error("socket hang up");
        }

        return refundsByKey.get(options.idempotencyKey);
      },
      async retrieve(id) {
        return [...refundsByKey.values()].find((refund) => refund.id === id);
      },
      async list() {
        return { data: [...refundsByKey.values()], has_more: false };
      },
    },
  };
}

function recoveryPass(backend, stripe) {
  return recoverStuckBookingRefunds({
    supabase: backend.supabase,
    processRefund: (id, options) => processBookingRefund(id, { ...options, stripe }),
  });
}

test("a refund interrupted by a Stripe outage is recovered later with its original idempotency key", async () => {
  const backend = statefulRefundBackend();
  const stripe = idempotentStripe({ failCreateTimes: 1 });

  // The attempt made during cancellation: Stripe is unreachable, nothing is refunded.
  const interrupted = await processBookingRefund("refund-op-1", {
    stripe,
    supabase: backend.supabase,
  });
  assert.equal(interrupted.action, "pending");
  assert.equal(backend.row.status, "pending");
  assert.equal(stripe.refundsByKey.size, 0);

  // The scheduled pass finds it, proves no refund exists, and retries.
  assert.deepEqual(await recoveryPass(backend, stripe), {
    listed: 1,
    outcomes: { verify_before_retry: 1 },
    failed: 0,
  });
  assert.equal(backend.row.status, "succeeded");
  assert.equal(backend.row.stripe_refund_id, "re_1");

  // Later passes have nothing to do.
  assert.deepEqual(await recoveryPass(backend, stripe), { listed: 0, outcomes: {}, failed: 0 });

  assert.deepEqual(backend.claimedActions, ["create", "verify_before_retry"]);
  assert.deepEqual(stripe.createKeys, ["ceaute-refund-op-1", "ceaute-refund-op-1"]);
  assert.equal(stripe.refundsByKey.size, 1);
});

test("a refund Stripe created but whose response was lost is adopted, never created again", async () => {
  const backend = statefulRefundBackend();
  const stripe = idempotentStripe({ loseFirstResponse: true });

  // Stripe made the refund and the response never arrived. The immediate
  // reconciliation already adopts it.
  const interrupted = await processBookingRefund("refund-op-1", {
    stripe,
    supabase: backend.supabase,
  });
  assert.equal(interrupted.action, "reconciled");
  assert.equal(backend.row.stripe_refund_id, "re_1");

  assert.deepEqual(await recoveryPass(backend, stripe), { listed: 0, outcomes: {}, failed: 0 });
  assert.deepEqual(stripe.createKeys, ["ceaute-refund-op-1"]);
  assert.equal(stripe.refundsByKey.size, 1);
});

test("a driver that died mid-request is reconciled from Stripe's refund list before any retry", async () => {
  // The function timed out after Stripe accepted the refund: the operation is
  // left with a create attempt and no refund id.
  const backend = statefulRefundBackend({ createAttemptedBefore: true });
  const stripe = idempotentStripe();
  stripe.refundsByKey.set("ceaute-refund-op-1", {
    id: "re_existing",
    status: "succeeded",
    amount: 1500,
    payment_intent: "pi_test",
    charge: "ch_test",
    failure_reason: null,
    metadata: { refund_operation_id: "refund-op-1" },
  });

  assert.deepEqual(await recoveryPass(backend, stripe), {
    listed: 1,
    outcomes: { reconciled: 1 },
    failed: 0,
  });
  assert.equal(backend.row.stripe_refund_id, "re_existing");
  assert.deepEqual(stripe.createKeys, []);
});

test("replaying a finished refund never reaches Stripe", async () => {
  const backend = statefulRefundBackend();
  const stripe = idempotentStripe();

  await processBookingRefund("refund-op-1", { stripe, supabase: backend.supabase });
  // Even if an operation were handed over again by mistake, the claim answers
  // "complete" and the processor returns without a Stripe request.
  const replay = await processBookingRefund("refund-op-1", {
    stripe,
    supabase: backend.supabase,
  });

  assert.equal(replay.action, "complete");
  assert.deepEqual(stripe.createKeys, ["ceaute-refund-op-1"]);
  assert.equal(stripe.refundsByKey.size, 1);
});

test("an ambiguous Stripe history parks the operation for review and later passes skip it", async () => {
  const backend = statefulRefundBackend({ createAttemptedBefore: true });
  const stripe = idempotentStripe();
  // A refund carrying this operation's identity exists with the wrong amount.
  stripe.refundsByKey.set("other-key", {
    id: "re_wrong",
    status: "succeeded",
    amount: 700,
    payment_intent: "pi_test",
    charge: "ch_test",
    metadata: { refund_operation_id: "refund-op-1" },
  });

  assert.deepEqual(await recoveryPass(backend, stripe), {
    listed: 1,
    outcomes: { requires_review: 1 },
    failed: 0,
  });
  assert.equal(backend.row.status, "requires_review");
  assert.deepEqual(await recoveryPass(backend, stripe), { listed: 0, outcomes: {}, failed: 0 });
  assert.deepEqual(stripe.createKeys, []);
});
