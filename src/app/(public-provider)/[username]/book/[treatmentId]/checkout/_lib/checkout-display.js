import { formatPricePence } from "@/features/storefront/format";

// Mirrors prepare_booking_cancellation: a late customer cancellation retains
// least(commitment amount, amount actually paid online) and refunds the rest.
// Both checkout steps state this, because the Terms promise the retained
// amount is shown before the customer pays.
export function describeLateCancellationOutcome({
  commitmentAmountPence,
  amountDueNowPence,
}) {
  const retainedPence = Math.min(
    Math.max(0, Number(commitmentAmountPence ?? 0)),
    amountDueNowPence,
  );

  return retainedPence < amountDueNowPence
    ? `${formatPricePence(retainedPence)} is retained after late cancellation and the rest is refunded.`
    : `${formatPricePence(retainedPence)} is retained after late cancellation.`;
}

export function calculatePaymentSummary({ bookingSettings, totalPricePence }) {
  if (bookingSettings.payment_mode === "fixed_deposit") {
    const amountDueNow = Math.min(
      Number(bookingSettings.commitment_amount_pence ?? 0),
      totalPricePence,
    );

    return {
      amountDueNow,
      amountDueAtAppointment: totalPricePence - amountDueNow,
      cancellationOutcome: describeLateCancellationOutcome({
        commitmentAmountPence: bookingSettings.commitment_amount_pence,
        amountDueNowPence: amountDueNow,
      }),
    };
  }

  return {
    amountDueNow: totalPricePence,
    amountDueAtAppointment: 0,
    cancellationOutcome: describeLateCancellationOutcome({
      commitmentAmountPence:
        bookingSettings.commitment_amount_pence ?? totalPricePence,
      amountDueNowPence: totalPricePence,
    }),
  };
}

export function getBookingDisplayState(booking, now = Date.now()) {
  if (booking.status === "confirmed") {
    return {
      heading: "Booking confirmed",
      message: "Your booking is confirmed.",
      canPay: false,
    };
  }

  const expiresAt = new Date(booking.expires_at ?? "").getTime();
  const isExpired =
    booking.status === "expired" ||
    (["awaiting_payment", "cancelled"].includes(booking.status) &&
      expiresAt <= now);

  if (isExpired) {
    return {
      heading: "Slot expired",
      message: "That held slot expired. Please choose a new time.",
      canPay: false,
    };
  }

  if (booking.status === "cancelled") {
    return {
      heading: "Booking cancelled",
      message: "This booking was cancelled and is not confirmed.",
      canPay: false,
    };
  }

  if (booking.status !== "awaiting_payment" || !Number.isFinite(expiresAt)) {
    return {
      heading: "Booking unavailable",
      message: "This booking cannot continue. Please choose a new time.",
      canPay: false,
    };
  }

  if (["failed", "cancelled"].includes(booking.payment_status)) {
    return {
      heading: "Payment failed",
      message: "Payment was not completed. Your booking has not been confirmed.",
      canPay: true,
      showHoldExpiry: true,
    };
  }

  if (
    ["refund_required", "refunded", "refund_failed"].includes(booking.payment_status)
  ) {
    return {
      heading: "Payment unsuccessful",
      message:
        "Your payment could not confirm this booking. Please choose a new time.",
      canPay: false,
      showHoldExpiry: true,
    };
  }

  if (
    ["created", "checkout_created", "succeeded"].includes(booking.payment_status)
  ) {
    return {
      heading: "Booking held",
      message:
        "Payment is being verified. This page will show confirmation once Stripe's webhook confirms it.",
      canPay: booking.payment_status !== "succeeded",
      showHoldExpiry: true,
    };
  }

  return {
    heading: "Booking held",
    message: "This time is held for 5 minutes while you continue.",
    canPay: !booking.payment_status,
    showHoldExpiry: true,
  };
}
