import assert from "node:assert/strict";
import test from "node:test";
import { recoverStuckBookingRefunds } from "../src/lib/payments/refund-recovery.js";

function fakeSupabase(rows, { error = null } = {}) {
  const calls = [];

  return {
    calls,
    schema(name) {
      assert.equal(name, "ceaute");
      return {
        async rpc(functionName, parameters) {
          calls.push({ functionName, parameters });
          return { data: error ? null : rows, error };
        },
      };
    },
  };
}

test("each listed operation is handed to the refund processor with the same client", async () => {
  const supabase = fakeSupabase([
    { refund_operation_id: "op-1", refund_status: "requested" },
    { refund_operation_id: "op-2", refund_status: "pending" },
  ]);
  const processed = [];

  const summary = await recoverStuckBookingRefunds({
    limit: 10,
    supabase,
    processRefund: async (id, options) => {
      processed.push({ id, supabase: options.supabase });
      return { action: id === "op-1" ? "create" : "reconciled", status: "pending" };
    },
  });

  assert.deepEqual(supabase.calls, [
    {
      functionName: "list_retryable_booking_refund_operations",
      parameters: { max_operations: 10 },
    },
  ]);
  assert.deepEqual(
    processed.map((entry) => entry.id),
    ["op-1", "op-2"],
  );
  assert.ok(processed.every((entry) => entry.supabase === supabase));
  assert.deepEqual(summary, {
    listed: 2,
    outcomes: { create: 1, reconciled: 1 },
    failed: 0,
  });
});

test("one failing operation does not stop the rest of the batch", async () => {
  const supabase = fakeSupabase([
    { refund_operation_id: "op-1", refund_status: "requested" },
    { refund_operation_id: "op-2", refund_status: "requested" },
    { refund_operation_id: "op-3", refund_status: "processing" },
  ]);
  const originalConsoleError = console.error;
  const logged = [];
  console.error = (...args) => logged.push(args);

  try {
    const summary = await recoverStuckBookingRefunds({
      supabase,
      processRefund: async (id) => {
        if (id === "op-2") {
          throw new Error("Stripe is not configured.");
        }

        return { action: "create", status: "pending" };
      },
    });

    assert.deepEqual(summary, {
      listed: 3,
      outcomes: { create: 2 },
      failed: 1,
    });
    assert.equal(logged.length, 1);
    assert.equal(logged[0][1].refundOperationId, "op-2");
  } finally {
    console.error = originalConsoleError;
  }
});

test("an empty list processes nothing", async () => {
  const supabase = fakeSupabase([]);

  const summary = await recoverStuckBookingRefunds({
    supabase,
    processRefund: async () => {
      throw new Error("must not be called");
    },
  });

  assert.deepEqual(summary, { listed: 0, outcomes: {}, failed: 0 });
});

test("a failed listing throws so the cron route reports a failure", async () => {
  const supabase = fakeSupabase(null, { error: { message: "permission denied" } });

  await assert.rejects(
    recoverStuckBookingRefunds({ supabase, processRefund: async () => ({}) }),
    /Could not list retryable refund operations/,
  );
});
