// What the customer reads after cancelling or reviewing. The rules stay in
// PostgreSQL (prepare_booking_cancellation, create_booking_review); this only
// words the result for the screen.
import { formatPounds } from "@/lib/bookings/booking-money";
import { legalIdentity } from "@/lib/legal/identity";

const CANCELLATION_REASONS = [
  "Completed bookings cannot be cancelled.",
  "Only confirmed bookings can be cancelled.",
  "Past bookings cannot be cancelled.",
  "Booking payment is not complete.",
  "Booking not found.",
];

// The refund's state right after cancelling. Never claims money is on its way
// when Stripe refused the refund, and never promises when it arrives.
export function customerCancellationSuccess(refundAmountPence, refundStatus = null) {
  const refund = Number(refundAmountPence) || 0;

  if (refund <= 0) {
    return { status: "cancelled", message: "Booking cancelled." };
  }

  const amount = formatPounds(refund);

  if (refundStatus === "succeeded") {
    return { status: "cancelled", message: `Booking cancelled. We’ve refunded ${amount} to the card you paid with.` };
  }

  if (refundStatus === "failed" || refundStatus === "requires_review") {
    return {
      status: "cancelled",
      message: `Booking cancelled. We couldn’t refund ${amount} automatically. Email ${legalIdentity.contactEmail} and we’ll put it right.`,
    };
  }

  return { status: "cancelled", message: `Booking cancelled. We’re refunding ${amount} to the card you paid with.` };
}

// A failure may come after the booking was already cancelled (the refund
// step), so an unrecognised one never claims nothing happened.
export function customerCancellationFailure(error) {
  const text = String(error?.message ?? "");
  const known = CANCELLATION_REASONS.find((reason) => text.includes(reason));

  return {
    status: "error",
    message: known ?? "We couldn’t finish cancelling. Refresh to see your booking’s current status.",
  };
}

const REVIEW_REASONS = [
  "Choose a rating from 1 to 5.",
  "Only completed bookings can be reviewed.",
  "You cannot review your own provider page.",
  "Verify your phone number before reviewing.",
  "Review comments must be 1000 characters or fewer.",
];

export function reviewFailure(error) {
  const text = String(error?.message ?? "");
  const known = REVIEW_REASONS.find((reason) => text.includes(reason));

  return {
    status: "error",
    message: known ?? "We couldn’t save your review. Try again.",
  };
}
