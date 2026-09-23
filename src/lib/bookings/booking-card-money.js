// The one money fact a booking card shows (approved 23 September 2026), for
// both the provider's Bookings and the customer's My bookings. Each answer is
// only given when the booking's own figures prove it: a refund is "refunded"
// only once the payment says so, and "paid in full" only when what was paid
// online is the whole price. Anything unproven shows nothing; the booking's
// page has the full breakdown.

const whole = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isInteger(number) ? number : null;
};

// An upcoming booking: money still to collect at the appointment, or paid in
// full online, or nothing when the figures are missing.
export function upcomingMoney(booking) {
  const due = whole(booking.amount_due_at_appointment_pence);
  const paid = whole(booking.amount_paid_online_pence);
  const total = whole(booking.total_price_pence);

  if (due !== null && due > 0) {
    return { kind: "collect", pence: due };
  }

  if (due === 0 && paid !== null && paid > 0 && total !== null && paid === total) {
    return { kind: "paid_in_full" };
  }

  return null;
}

// A cancelled booking: what actually happened to the money paid online.
export function cancellationRefund(booking) {
  const paid = whole(booking.amount_paid_online_pence);
  const refund = whole(booking.refund_amount_pence);
  const status = booking.payment_status ?? null;

  if (refund !== null && refund > 0) {
    if (status === "refunded") return { kind: "refunded", pence: refund };
    if (status === "refund_failed") return { kind: "failed", pence: refund };
    return { kind: "pending", pence: refund };
  }

  if (refund === 0 && paid !== null && paid > 0) {
    return { kind: "none" };
  }

  return null;
}
