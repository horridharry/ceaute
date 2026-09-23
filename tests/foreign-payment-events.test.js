import assert from "node:assert/strict";
import test from "node:test";
import { isForeignFailureEvent } from "../src/lib/payments/foreign-payment-events.js";

const KNOWN_ATTEMPT = "11111111-1111-4111-8111-111111111111";
const UNKNOWN_ATTEMPT = "22222222-2222-4222-8222-222222222222";

// Answers the one lookup the module makes and records how it was asked.
function fakeSupabase({ existingIds = [KNOWN_ATTEMPT], error = null } = {}) {
  const lookups = [];

  return {
    lookups,
    schema(schemaName) {
      return {
        from(table) {
          return {
            select(columns) {
              return {
                eq(column, value) {
                  return {
                    async maybeSingle() {
                      lookups.push({ schemaName, table, columns, column, value });

                      if (error) {
                        return { data: null, error };
                      }

                      return {
                        data: existingIds.includes(value) ? { id: value } : null,
                        error: null,
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

test("an expired Checkout Session for an attempt this database never created is foreign", async () => {
  const supabase = fakeSupabase();

  const foreign = await isForeignFailureEvent({
    supabase,
    eventType: "checkout.session.expired",
    paymentAttemptId: UNKNOWN_ATTEMPT,
  });

  assert.equal(foreign, true);
  assert.deepEqual(supabase.lookups, [
    {
      schemaName: "ceaute",
      table: "booking_payment_attempt",
      columns: "id",
      column: "id",
      value: UNKNOWN_ATTEMPT,
    },
  ]);
});

test("an expired Checkout Session for a known attempt is processed as before", async () => {
  const foreign = await isForeignFailureEvent({
    supabase: fakeSupabase(),
    eventType: "checkout.session.expired",
    paymentAttemptId: KNOWN_ATTEMPT,
  });

  assert.equal(foreign, false);
});

test("failed and cancelled PaymentIntents for unknown attempts are also foreign", async () => {
  for (const eventType of ["payment_intent.payment_failed", "payment_intent.canceled"]) {
    assert.equal(
      await isForeignFailureEvent({
        supabase: fakeSupabase(),
        eventType,
        paymentAttemptId: UNKNOWN_ATTEMPT,
      }),
      true,
      eventType,
    );
  }
});

test("events that move money are never treated as foreign, even for an unknown attempt", async () => {
  for (const eventType of [
    "checkout.session.completed",
    "refund.updated",
    "refund.failed",
    "charge.dispute.created",
  ]) {
    const supabase = fakeSupabase();

    assert.equal(
      await isForeignFailureEvent({ supabase, eventType, paymentAttemptId: UNKNOWN_ATTEMPT }),
      false,
      eventType,
    );
    assert.equal(supabase.lookups.length, 0, `${eventType} makes no lookup`);
  }
});

test("a failure event without attempt metadata keeps its existing handling", async () => {
  const supabase = fakeSupabase();

  const foreign = await isForeignFailureEvent({
    supabase,
    eventType: "checkout.session.expired",
    paymentAttemptId: null,
  });

  assert.equal(foreign, false);
  assert.equal(supabase.lookups.length, 0);
});

test("an attempt ID that is not a UUID cannot belong to this database", async () => {
  const supabase = fakeSupabase();

  const foreign = await isForeignFailureEvent({
    supabase,
    eventType: "checkout.session.expired",
    paymentAttemptId: "not-a-uuid",
  });

  assert.equal(foreign, true);
  assert.equal(supabase.lookups.length, 0);
});

test("a failed lookup is an error, not a guess that the attempt is foreign", async () => {
  await assert.rejects(
    isForeignFailureEvent({
      supabase: fakeSupabase({ error: { message: "connection reset" } }),
      eventType: "checkout.session.expired",
      paymentAttemptId: UNKNOWN_ATTEMPT,
    }),
    /Could not look up the Stripe event's payment attempt/,
  );
});
