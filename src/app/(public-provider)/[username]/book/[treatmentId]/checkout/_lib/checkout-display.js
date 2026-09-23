// What the held page shows when a customer comes back from Stripe or returns
// to a hold later (Specification §9.5). The page only reads state; only the
// signed Stripe webhook ever confirms a booking.
//
// Checked in this order, so a late payment is never shown as "Slot expired"
// (audit defect) and a successful return never offers Pay again.

const OPEN_ATTEMPT_STATUSES = new Set(["created", "checkout_creating", "checkout_created"]);

export function heldBookingState({
  booking,
  checkout = "",
  payment = "",
  notice = "",
  acceptingBookings = true,
  now = Date.now(),
}) {
  // Confirmed at some point (and perhaps cancelled since): its own booking
  // page explains it, money included.
  if (booking.confirmed_at) {
    return { kind: "confirmed" };
  }

  // Money was taken but no booking was made: the payment arrived after the
  // hold ended and is being refunded in full.
  if (booking.paid_attempt) {
    return {
      kind: "late_payment",
      refundStatus: booking.paid_attempt.payment_status,
      amountPence: booking.paid_attempt.amount_charged_pence,
    };
  }

  // Stripe only returns here after a successful card payment; the webhook
  // that confirms it may still be on its way.
  if (checkout === "success") {
    return { kind: "confirming" };
  }

  if (payment === "unavailable") {
    return { kind: "unavailable" };
  }

  const expiresAt = Date.parse(booking.expires_at ?? "");
  const live = booking.status === "awaiting_payment" && Number.isFinite(expiresAt) && expiresAt > now;

  if (payment === "processing") {
    return { kind: "processing" };
  }

  if (!live) {
    return { kind: "expired" };
  }

  // The provider stopped taking bookings while the time was held (paused
  // terms, payments or agreement). PostgreSQL refuses the Checkout claim too.
  if (!acceptingBookings) {
    return { kind: "unavailable" };
  }

  if (notice === "terms_changed") {
    return { kind: "terms_changed", canPay: true };
  }

  if (payment === "failed_to_open") {
    return { kind: "failed_to_open", canPay: true };
  }

  if (booking.payment_status === "failed") {
    return { kind: "failed", canPay: true };
  }

  if (checkout === "cancelled" || payment === "expired" || OPEN_ATTEMPT_STATUSES.has(booking.payment_status)) {
    return { kind: "not_finished", canPay: true };
  }

  return { kind: "held", canPay: true };
}

// "10:42 am" in London time.
export function formatHeldUntil(expiresAt) {
  const value = new Date(expiresAt);

  if (Number.isNaN(value.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone: "Europe/London",
  }).format(value);
}

export function heldBookingCopy(state, { providerName, heldUntil, refundAmount, contactEmail }) {
  const until = heldUntil ? ` until ${heldUntil}` : "";

  switch (state.kind) {
    case "late_payment": {
      const refund =
        state.refundStatus === "refunded"
          ? `We’ve refunded ${refundAmount} in full to the card you paid with.`
          : state.refundStatus === "refund_failed"
            ? `We couldn’t send your ${refundAmount} refund automatically and we’re looking into it. If you have questions, email ${contactEmail}.`
            : `We’re refunding ${refundAmount} in full to the card you paid with.`;

      return {
        title: "We couldn’t book this time",
        message: `Your payment arrived after the held time ended, so the booking wasn’t made. ${refund} We’ve emailed you about it.`,
      };
    }
    case "confirming":
      return {
        title: "Confirming your payment…",
        message: "This usually takes a few seconds. Please don’t pay again.",
      };
    case "unavailable":
      return {
        title: `${providerName} can’t take bookings right now`,
        message: "Nothing has been charged. Try again later, or book with someone else.",
      };
    case "processing":
      return {
        title: "A payment is already being processed",
        message: "Another payment for this booking is still finishing. Check My bookings in a moment before paying again.",
      };
    case "expired":
      return {
        title: "Your held time has ended",
        message: "Nothing has been charged. The time may still be free: choose it again to book.",
      };
    case "terms_changed":
      return {
        title: "Check the updated price",
        message: `${providerName} changed this booking’s price or terms after you reviewed it. Nothing has been charged. Your time is held${until} on the terms below.`,
      };
    case "failed_to_open":
      return {
        title: "We couldn’t open the payment page",
        message: `Nothing has been charged. Your time is held${until}. Try again.`,
      };
    case "failed":
      return {
        title: "Payment didn’t go through",
        message: `Nothing was charged. Your time is held${until}.`,
      };
    case "not_finished":
      return {
        title: "Payment not finished",
        message: `Your time is held${until}. Nothing has been charged.`,
      };
    default:
      return {
        title: "Your time is held",
        message: `Held${until}. Nothing has been charged yet.`,
      };
  }
}
