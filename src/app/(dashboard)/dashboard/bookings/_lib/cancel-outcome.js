// What the provider reads after asking to cancel a booking. The cancellation
// and its refund are decided by prepare_booking_cancellation and
// cancelBookingWithRefund, unchanged; this only words the result.
const KNOWN_REASONS = [
  "Completed bookings cannot be cancelled.",
  "Only confirmed bookings can be cancelled.",
  "Past bookings cannot be cancelled.",
  "Booking payment is not complete.",
  "Booking not found.",
];

export function providerCancellationSuccess(customerName) {
  const firstName = String(customerName ?? "").trim().split(/\s+/)[0] || "The customer";

  return {
    status: "cancelled",
    message: `Booking cancelled. ${firstName} will be refunded the amount paid online.`,
  };
}

// A failure may come from the database refusing (nothing changed) or from the
// refund step after the booking was already cancelled, so an unrecognised
// failure never claims that nothing happened.
export function providerCancellationFailure(error) {
  const text = String(error?.message ?? "");
  const known = KNOWN_REASONS.find((reason) => text.includes(reason));

  return {
    status: "error",
    message: known ?? "Couldn’t finish cancelling. Refresh to see the booking’s current status.",
  };
}
