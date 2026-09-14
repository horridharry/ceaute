import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateBookingPaymentAmounts,
  meetsPositiveDepositRule,
} from "../src/lib/payments/booking-payments.js";

test("rejects a zero or missing deposit in deposit mode", () => {
  for (const commitmentAmountPence of [0, null, -100]) {
    assert.equal(
      meetsPositiveDepositRule({
        paymentMode: "fixed_deposit",
        commitmentAmountPence,
      }),
      false,
    );
  }
});

test("accepts a positive deposit", () => {
  assert.equal(
    meetsPositiveDepositRule({
      paymentMode: "fixed_deposit",
      commitmentAmountPence: 1,
    }),
    true,
  );
});

test("does not apply the deposit rule to full payment", () => {
  for (const commitmentAmountPence of [0, null]) {
    assert.equal(
      meetsPositiveDepositRule({ paymentMode: "full", commitmentAmountPence }),
      true,
    );
  }
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
