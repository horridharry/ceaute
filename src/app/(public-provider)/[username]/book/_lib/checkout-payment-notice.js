// Copy for the `payment` query parameter that startStripeCheckoutForBooking
// redirects back with when it cannot hand the customer to Stripe. The action
// already distinguishes the three cases; without this the customer returned to
// an unchanged checkout page and was given no reason at all.
//
// The wording stays deliberately vague about the provider's Stripe state: the
// customer cannot act on it, and the same `unavailable` redirect also covers an
// unpublished page and a payment attempt that has already reached a terminal
// state.
const NOTICE_BY_STATE = new Map([
  [
    "unavailable",
    {
      heading: "Payment is not available",
      message:
        "Ceaute could not start a payment for this booking because this provider cannot take online payments right now. Try again later, or choose another time.",
    },
  ],
  [
    "expired",
    {
      heading: "That payment session expired",
      message:
        "The payment was not completed in time. If the held time above is still valid you can pay again, otherwise choose a new time.",
    },
  ],
  [
    "processing",
    {
      heading: "A payment is already being processed",
      message:
        "Another payment attempt for this booking is still finishing. Wait a few seconds, reload this page, and check whether it is confirmed before paying again.",
    },
  ],
]);

export function describeCheckoutPaymentNotice(paymentState) {
  const state = String(paymentState ?? "").trim();

  return NOTICE_BY_STATE.get(state) ?? null;
}
