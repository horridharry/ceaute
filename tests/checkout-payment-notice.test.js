import assert from "node:assert/strict";
import test from "node:test";
import { describeCheckoutPaymentNotice } from "../src/app/(public-provider)/[username]/book/_lib/checkout-payment-notice.js";

// The three states startStripeCheckoutForBooking redirects back with.
const REDIRECT_STATES = ["unavailable", "expired", "processing"];

test("every payment redirect state the checkout action emits has customer copy", () => {
  for (const state of REDIRECT_STATES) {
    const notice = describeCheckoutPaymentNotice(state);

    assert.ok(notice, `no copy for payment=${state}`);
    assert.ok(notice.heading, `no heading for payment=${state}`);
    assert.ok(notice.message, `no message for payment=${state}`);
  }
});

test("each state explains something different to the customer", () => {
  const messages = REDIRECT_STATES.map(
    (state) => describeCheckoutPaymentNotice(state).message,
  );

  assert.equal(new Set(messages).size, REDIRECT_STATES.length);
});

test("an unavailable payment does not blame the customer or leak provider state", () => {
  const { message } = describeCheckoutPaymentNotice("unavailable");

  assert.match(message, /provider cannot take online payments/i);
  assert.doesNotMatch(message, /stripe/i);
});

test("an expired session tells the customer how to continue", () => {
  const { message } = describeCheckoutPaymentNotice("expired");

  assert.match(message, /choose a new time/i);
});

test("a processing payment warns against paying twice", () => {
  const { message } = describeCheckoutPaymentNotice("processing");

  assert.match(message, /before paying again/i);
});

test("no notice is shown when the page was not redirected back", () => {
  assert.equal(describeCheckoutPaymentNotice(undefined), null);
  assert.equal(describeCheckoutPaymentNotice(null), null);
  assert.equal(describeCheckoutPaymentNotice(""), null);
});

test("an unrecognised payment value is ignored rather than guessed at", () => {
  assert.equal(describeCheckoutPaymentNotice("succeeded"), null);
  assert.equal(describeCheckoutPaymentNotice("<script>"), null);
});
