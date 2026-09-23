import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBookingPaymentAmounts,
  snapshotAmountDueNowPence,
} from "../src/lib/payments/booking-payments.js";

// The amount charged online is read from the booking's snapshot, which
// PostgreSQL wrote with ceaute.booking_payment_terms when the hold was made.
// JavaScript never calculates a percentage (docs/decisions/006).

test("a percentage snapshot charges exactly the amount PostgreSQL stored", () => {
  const snapshot = {
    payment_mode: "deposit",
    deposit_percent: 25,
    total_price_pence: 4999,
    amount_due_now_pence: 1250,
    commitment_amount_pence: 1250,
  };

  assert.equal(snapshotAmountDueNowPence(snapshot), 1250);
  const amounts = calculateBookingPaymentAmounts(snapshot);
  assert.equal(amounts.amountChargedPence, 1250);
  assert.equal(amounts.amountDueLaterPence, 3749);
  assert.equal(amounts.totalBookingValuePence, 4999);
});

test("the £1 minimum stored in the snapshot is what is charged, not the percentage", () => {
  // 10% of £5.00 is 50p; the customer pays £1.00 and a late cancellation
  // keeps only the 50p.
  const snapshot = {
    payment_mode: "deposit",
    deposit_percent: 10,
    total_price_pence: 500,
    amount_due_now_pence: 100,
    commitment_amount_pence: 50,
  };

  assert.equal(calculateBookingPaymentAmounts(snapshot).amountChargedPence, 100);
  assert.equal(calculateBookingPaymentAmounts(snapshot).amountDueLaterPence, 400);
});

test("full payment charges the whole price whatever is kept after a late cancellation", () => {
  const snapshot = {
    payment_mode: "full",
    deposit_percent: 50,
    total_price_pence: 4000,
    amount_due_now_pence: 4000,
    commitment_amount_pence: 2000,
  };

  assert.equal(calculateBookingPaymentAmounts(snapshot).amountChargedPence, 4000);
  assert.equal(calculateBookingPaymentAmounts(snapshot).amountDueLaterPence, 0);
});

test("a snapshot from before percentage terms keeps the rule it was made under", () => {
  // Fixed £ deposit: the stored commitment, never more than the price.
  assert.equal(
    snapshotAmountDueNowPence({ payment_mode: "fixed_deposit", commitment_amount_pence: 1000, total_price_pence: 5000 }),
    1000,
  );
  assert.equal(
    snapshotAmountDueNowPence({ payment_mode: "fixed_deposit", commitment_amount_pence: 9000, total_price_pence: 5000 }),
    5000,
  );
  // Old full payment with a blank retained amount: the whole price.
  assert.equal(
    snapshotAmountDueNowPence({ payment_mode: "full", commitment_amount_pence: null, total_price_pence: 5000 }),
    5000,
  );
});

test("a zero deposit would leave nothing to charge online", () => {
  assert.equal(
    calculateBookingPaymentAmounts({
      payment_mode: "fixed_deposit",
      commitment_amount_pence: 0,
      total_price_pence: 5000,
    }).amountChargedPence,
    0,
  );
});

test("a positive deposit is charged online with the balance due later", () => {
  const amounts = calculateBookingPaymentAmounts({
    payment_mode: "fixed_deposit",
    commitment_amount_pence: 1000,
    total_price_pence: 5000,
  });

  assert.equal(amounts.amountChargedPence, 1000);
  assert.equal(amounts.amountDueLaterPence, 4000);
});
