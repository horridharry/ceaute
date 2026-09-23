import assert from "node:assert/strict";
import test from "node:test";
import { cancellationRefund, upcomingMoney } from "../src/lib/bookings/booking-card-money.js";

// Approved 23 September 2026: cards show "To collect £X" or "Paid in full"
// only where accurate, and a cancelled card shows the refund's actual state;
// a pending or failed refund is never "Refunded".

test("a deposit booking shows what is left to collect", () => {
  assert.deepEqual(
    upcomingMoney({ amount_due_at_appointment_pence: 5680, amount_paid_online_pence: 2420, total_price_pence: 8100 }),
    { kind: "collect", pence: 5680 },
  );
});

test("a booking paid online in full says so", () => {
  assert.deepEqual(
    upcomingMoney({ amount_due_at_appointment_pence: 0, amount_paid_online_pence: 5100, total_price_pence: 5100 }),
    { kind: "paid_in_full" },
  );
});

test("missing or inconsistent figures show nothing rather than a guess", () => {
  assert.equal(upcomingMoney({ amount_due_at_appointment_pence: null, amount_paid_online_pence: 5100, total_price_pence: 5100 }), null);
  assert.equal(upcomingMoney({ amount_due_at_appointment_pence: 0, amount_paid_online_pence: 5000, total_price_pence: 5100 }), null);
  assert.equal(upcomingMoney({ amount_due_at_appointment_pence: 0, amount_paid_online_pence: 0, total_price_pence: 0 }), null);
  assert.equal(upcomingMoney({ amount_due_at_appointment_pence: 0, amount_paid_online_pence: 5100, total_price_pence: null }), null);
});

test("a refund is 'refunded' only once the payment records it", () => {
  assert.deepEqual(
    cancellationRefund({ amount_paid_online_pence: 4500, refund_amount_pence: 4500, payment_status: "refunded" }),
    { kind: "refunded", pence: 4500 },
  );
});

test("a refund still in progress is pending, whatever else is recorded", () => {
  for (const payment_status of ["refund_required", "succeeded", null]) {
    assert.deepEqual(
      cancellationRefund({ amount_paid_online_pence: 4500, refund_amount_pence: 4500, payment_status }),
      { kind: "pending", pence: 4500 },
    );
  }
});

test("a failed refund is reported as failed", () => {
  assert.deepEqual(
    cancellationRefund({ amount_paid_online_pence: 4500, refund_amount_pence: 4500, payment_status: "refund_failed" }),
    { kind: "failed", pence: 4500 },
  );
});

test("a late cancellation that keeps the whole payment shows no refund", () => {
  assert.deepEqual(
    cancellationRefund({ amount_paid_online_pence: 2420, refund_amount_pence: 0, payment_status: "succeeded" }),
    { kind: "none" },
  );
});

test("a cancellation with no payment record shows nothing about money", () => {
  assert.equal(cancellationRefund({ amount_paid_online_pence: 0, refund_amount_pence: null, payment_status: null }), null);
  assert.equal(cancellationRefund({ amount_paid_online_pence: 0, refund_amount_pence: 0, payment_status: null }), null);
});
