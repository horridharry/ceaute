import assert from "node:assert/strict";
import test from "node:test";
import {
  formatHeldUntil,
  heldBookingCopy,
  heldBookingState,
} from "../src/app/(public-provider)/[username]/book/[treatmentId]/checkout/_lib/checkout-display.js";

// The held page (Specification §9.5): what a customer sees when Stripe sends
// them back or they return to a hold later. The page reads state only; the
// webhook alone confirms a booking.

const NOW = Date.parse("2026-10-10T12:00:00.000Z");
const LIVE = "2026-10-10T12:06:00.000Z";
const ENDED = "2026-10-10T11:59:00.000Z";

function hold(overrides = {}) {
  return {
    status: "awaiting_payment",
    confirmed_at: null,
    expires_at: LIVE,
    payment_status: null,
    paid_attempt: null,
    ...overrides,
  };
}

const state = (booking, options = {}) => heldBookingState({ booking, now: NOW, ...options });

test("a booking that was ever confirmed goes to its own page, even if cancelled since", () => {
  assert.equal(state(hold({ status: "confirmed", confirmed_at: "2026-10-10T11:58:00.000Z" })).kind, "confirmed");
  assert.equal(
    state(hold({ status: "cancelled", confirmed_at: "2026-10-01T09:00:00.000Z", paid_attempt: { payment_status: "refunded" } }), { checkout: "success" }).kind,
    "confirmed",
  );
});

test("a payment that arrived after the hold ended is never shown as an expired slot and never offers Pay", () => {
  const late = state(
    hold({ status: "cancelled", expires_at: ENDED, paid_attempt: { payment_status: "refund_required", amount_charged_pence: 1418 } }),
    { checkout: "success" },
  );

  assert.equal(late.kind, "late_payment");
  assert.equal(late.refundStatus, "refund_required");
  assert.equal(late.canPay, undefined);
});

test("a successful return waits for the webhook instead of offering Pay again", () => {
  const confirming = state(hold(), { checkout: "success" });
  assert.equal(confirming.kind, "confirming");
  assert.equal(confirming.canPay, undefined);
  // Even once the hold has ended: the late payment arrives with the webhook.
  assert.equal(state(hold({ status: "cancelled", expires_at: ENDED }), { checkout: "success" }).kind, "confirming");
});

test("Checkout could not start because the provider is unavailable", () => {
  assert.equal(state(hold(), { payment: "unavailable" }).kind, "unavailable");
  assert.equal(state(hold(), { acceptingBookings: false }).kind, "unavailable", "the provider paused while the time was held");
});

test("another payment still finishing is shown before anything else can be tried", () => {
  assert.equal(state(hold(), { payment: "processing" }).kind, "processing");
});

test("an ended hold with nothing paid says so and offers no payment", () => {
  for (const booking of [
    hold({ expires_at: ENDED }),
    hold({ status: "cancelled", expires_at: ENDED }),
    hold({ status: "expired" }),
    hold({ expires_at: null }),
  ]) {
    const ended = state(booking);
    assert.equal(ended.kind, "expired");
    assert.equal(ended.canPay, undefined);
  }
  assert.equal(state(hold({ expires_at: ENDED }), { payment: "expired" }).kind, "expired");
});

test("a live hold can be paid in every recoverable state", () => {
  assert.deepEqual(state(hold(), { notice: "terms_changed" }), { kind: "terms_changed", canPay: true });
  assert.deepEqual(state(hold(), { payment: "failed_to_open" }), { kind: "failed_to_open", canPay: true });
  assert.deepEqual(state(hold({ payment_status: "failed" })), { kind: "failed", canPay: true });
  assert.deepEqual(state(hold(), { checkout: "cancelled" }), { kind: "not_finished", canPay: true });
  assert.deepEqual(state(hold(), { payment: "expired" }), { kind: "not_finished", canPay: true });
  assert.deepEqual(state(hold({ payment_status: "checkout_created" })), { kind: "not_finished", canPay: true });
  assert.deepEqual(state(hold()), { kind: "held", canPay: true });
});

test("the held time is shown in London time", () => {
  assert.equal(formatHeldUntil("2026-10-10T12:06:00.000Z"), "1:06 pm");
  assert.equal(formatHeldUntil("not a date"), "");
});

const copyFor = (kind, extra = {}) =>
  heldBookingCopy({ kind, ...extra }, {
    providerName: "Studio Nala",
    heldUntil: "1:06 pm",
    refundAmount: "£14.18",
    contactEmail: "help@example.test",
  });

test("every state explains itself and says whether anything was charged", () => {
  assert.equal(copyFor("late_payment", { refundStatus: "refund_required" }).title, "We couldn’t book this time");
  assert.match(copyFor("late_payment", { refundStatus: "refund_required" }).message, /We’re refunding £14\.18 in full to the card you paid with\./);
  assert.match(copyFor("late_payment", { refundStatus: "refunded" }).message, /We’ve refunded £14\.18 in full/);
  assert.match(copyFor("late_payment", { refundStatus: "refund_failed" }).message, /email help@example\.test/);
  assert.match(copyFor("confirming").message, /Please don’t pay again\./);
  assert.equal(copyFor("unavailable").title, "Studio Nala can’t take bookings right now");
  assert.match(copyFor("unavailable").message, /Nothing has been charged\./);
  assert.equal(copyFor("expired").title, "Your held time has ended");
  assert.match(copyFor("expired").message, /Nothing has been charged\./);
  assert.equal(copyFor("terms_changed").title, "Check the updated price");
  assert.match(copyFor("terms_changed").message, /held until 1:06 pm/);
  assert.equal(copyFor("failed").title, "Payment didn’t go through");
  assert.equal(copyFor("not_finished").title, "Payment not finished");
  assert.match(copyFor("processing").message, /before paying again/);

  const titles = ["late_payment", "confirming", "unavailable", "processing", "expired", "terms_changed", "failed_to_open", "failed", "not_finished", "held"]
    .map((kind) => copyFor(kind, { refundStatus: "refund_required" }).title);
  assert.equal(new Set(titles).size, titles.length, "no two states share a heading");
});

test("no copy promises when a refund arrives", () => {
  for (const refundStatus of ["refund_required", "refunded", "refund_failed"]) {
    assert.doesNotMatch(copyFor("late_payment", { refundStatus }).message, /\bdays?\b|\bwithin\b|\bsoon\b/i);
  }
});
