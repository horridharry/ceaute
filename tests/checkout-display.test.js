import assert from "node:assert/strict";
import test from "node:test";
import {
  calculatePaymentSummary,
  describeLateCancellationOutcome,
  getBookingDisplayState,
} from "../src/app/(public-provider)/[username]/book/[treatmentId]/checkout/_lib/checkout-display.js";

test("describeLateCancellationOutcome says the rest is refunded when the commitment is less than what was paid", () => {
  const message = describeLateCancellationOutcome({
    commitmentAmountPence: 1000,
    amountDueNowPence: 5000,
  });

  assert.equal(
    message,
    "£10.00 is retained after late cancellation and the rest is refunded.",
  );
});

test("describeLateCancellationOutcome drops the refund clause when the whole amount is retained", () => {
  const message = describeLateCancellationOutcome({
    commitmentAmountPence: 5000,
    amountDueNowPence: 5000,
  });

  assert.equal(message, "£50.00 is retained after late cancellation.");
});

test("describeLateCancellationOutcome treats a missing commitment as zero retained", () => {
  const message = describeLateCancellationOutcome({
    commitmentAmountPence: undefined,
    amountDueNowPence: 3000,
  });

  assert.equal(
    message,
    "£0.00 is retained after late cancellation and the rest is refunded.",
  );
});

test("describeLateCancellationOutcome floors a negative commitment at zero", () => {
  const message = describeLateCancellationOutcome({
    commitmentAmountPence: -500,
    amountDueNowPence: 3000,
  });

  assert.equal(
    message,
    "£0.00 is retained after late cancellation and the rest is refunded.",
  );
});

test("describeLateCancellationOutcome caps retention at the amount actually due, even if commitment is higher", () => {
  const message = describeLateCancellationOutcome({
    commitmentAmountPence: 9000,
    amountDueNowPence: 2000,
  });

  assert.equal(message, "£20.00 is retained after late cancellation.");
});

test("calculatePaymentSummary for a fixed deposit splits due-now from due-later", () => {
  const summary = calculatePaymentSummary({
    bookingSettings: {
      payment_mode: "fixed_deposit",
      commitment_amount_pence: 1000,
    },
    totalPricePence: 5000,
  });

  assert.equal(summary.amountDueNow, 1000);
  assert.equal(summary.amountDueAtAppointment, 4000);
  // The deposit is entirely retained on late cancellation, because the amount
  // paid now equals the commitment amount, so there is nothing to refund.
  assert.equal(
    summary.cancellationOutcome,
    "£10.00 is retained after late cancellation.",
  );
});

test("calculatePaymentSummary caps a deposit above the total at the total price", () => {
  const summary = calculatePaymentSummary({
    bookingSettings: {
      payment_mode: "fixed_deposit",
      commitment_amount_pence: 9000,
    },
    totalPricePence: 5000,
  });

  assert.equal(summary.amountDueNow, 5000);
  assert.equal(summary.amountDueAtAppointment, 0);
});

test("calculatePaymentSummary for full payment charges the whole price up front", () => {
  const summary = calculatePaymentSummary({
    bookingSettings: { payment_mode: "full", commitment_amount_pence: 1000 },
    totalPricePence: 5000,
  });

  assert.equal(summary.amountDueNow, 5000);
  assert.equal(summary.amountDueAtAppointment, 0);
  // Even in "full payment" mode, the cancellation outcome is phrased around
  // the provider's configured commitment amount, not the amount just paid.
  assert.equal(
    summary.cancellationOutcome,
    "£10.00 is retained after late cancellation and the rest is refunded.",
  );
});

test("calculatePaymentSummary for full payment falls back to the total price when no commitment is set", () => {
  const summary = calculatePaymentSummary({
    bookingSettings: { payment_mode: "full", commitment_amount_pence: null },
    totalPricePence: 5000,
  });

  assert.equal(summary.cancellationOutcome, "£50.00 is retained after late cancellation.");
});

const NOW = new Date("2026-09-21T12:00:00.000Z").getTime();

test("getBookingDisplayState shows a confirmed booking and blocks payment", () => {
  const state = getBookingDisplayState({ status: "confirmed" }, NOW);

  assert.deepEqual(state, {
    heading: "Booking confirmed",
    message: "Your booking is confirmed.",
    canPay: false,
  });
});

test("getBookingDisplayState treats an explicitly expired status as expired", () => {
  const state = getBookingDisplayState(
    { status: "expired", expires_at: "2026-09-21T11:00:00.000Z" },
    NOW,
  );

  assert.equal(state.heading, "Slot expired");
  assert.equal(state.canPay, false);
});

test("getBookingDisplayState treats an awaiting_payment hold past its expiry as expired", () => {
  const state = getBookingDisplayState(
    { status: "awaiting_payment", expires_at: "2026-09-21T11:59:00.000Z" },
    NOW,
  );

  assert.equal(state.heading, "Slot expired");
});

test("getBookingDisplayState reports a cancelled booking that has not expired as cancelled, not expired", () => {
  const state = getBookingDisplayState(
    { status: "cancelled", expires_at: "2026-09-21T13:00:00.000Z" },
    NOW,
  );

  assert.equal(state.heading, "Booking cancelled");
  assert.equal(state.canPay, false);
});

test("getBookingDisplayState reports a cancelled booking whose hold already expired as expired", () => {
  const state = getBookingDisplayState(
    { status: "cancelled", expires_at: "2026-09-21T11:00:00.000Z" },
    NOW,
  );

  assert.equal(state.heading, "Slot expired");
});

test("getBookingDisplayState treats a non-awaiting_payment status with no usable expiry as unavailable", () => {
  const state = getBookingDisplayState(
    { status: "completed", expires_at: null },
    NOW,
  );

  assert.equal(state.heading, "Booking unavailable");
  assert.equal(state.canPay, false);
});

test("getBookingDisplayState surfaces a failed payment and still allows retrying", () => {
  const state = getBookingDisplayState(
    {
      status: "awaiting_payment",
      expires_at: "2026-09-21T13:00:00.000Z",
      payment_status: "failed",
    },
    NOW,
  );

  assert.equal(state.heading, "Payment failed");
  assert.equal(state.canPay, true);
  assert.equal(state.showHoldExpiry, true);
});

test("getBookingDisplayState treats a cancelled payment attempt the same as a failed one", () => {
  const state = getBookingDisplayState(
    {
      status: "awaiting_payment",
      expires_at: "2026-09-21T13:00:00.000Z",
      payment_status: "cancelled",
    },
    NOW,
  );

  assert.equal(state.heading, "Payment failed");
  assert.equal(state.canPay, true);
});

for (const paymentStatus of ["refund_required", "refunded", "refund_failed"]) {
  test(`getBookingDisplayState blocks payment when payment_status is ${paymentStatus}`, () => {
    const state = getBookingDisplayState(
      {
        status: "awaiting_payment",
        expires_at: "2026-09-21T13:00:00.000Z",
        payment_status: paymentStatus,
      },
      NOW,
    );

    assert.equal(state.heading, "Payment unsuccessful");
    assert.equal(state.canPay, false);
    assert.equal(state.showHoldExpiry, true);
  });
}

test("getBookingDisplayState shows a held booking as payable while Stripe checkout is in progress", () => {
  const state = getBookingDisplayState(
    {
      status: "awaiting_payment",
      expires_at: "2026-09-21T13:00:00.000Z",
      payment_status: "checkout_created",
    },
    NOW,
  );

  assert.equal(state.heading, "Booking held");
  assert.equal(state.canPay, true);
  assert.equal(state.showHoldExpiry, true);
});

test("getBookingDisplayState blocks a second payment once Stripe has already succeeded", () => {
  const state = getBookingDisplayState(
    {
      status: "awaiting_payment",
      expires_at: "2026-09-21T13:00:00.000Z",
      payment_status: "succeeded",
    },
    NOW,
  );

  assert.equal(state.heading, "Booking held");
  assert.equal(state.canPay, false);
});

test("getBookingDisplayState shows the initial 5-minute hold when there is no payment attempt yet", () => {
  const state = getBookingDisplayState(
    {
      status: "awaiting_payment",
      expires_at: "2026-09-21T13:00:00.000Z",
      payment_status: null,
    },
    NOW,
  );

  assert.equal(state.heading, "Booking held");
  assert.equal(state.message, "This time is held for 5 minutes while you continue.");
  assert.equal(state.canPay, true);
  assert.equal(state.showHoldExpiry, true);
});
