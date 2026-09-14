import { createServiceRoleClient } from "@/lib/supabase/service-role";

// Reads payment attempts with the privileged service-role client. Only pass IDs
// of bookings the caller has already loaded through an authorised booking query.
export async function getLatestPaymentAttemptsForBookings(bookingIds) {
  if (!bookingIds.length) {
    return new Map();
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking_payment_attempt")
    .select(
      "booking_id, attempt_number, amount_charged_pence, total_booking_value_pence, amount_due_later_pence, ceaute_fee_pence, payment_status, refund_amount_pence, retained_amount_pence, refund_requested_at, refunded_at, refund_failed_at, failure_reason",
    )
    .in("booking_id", bookingIds);

  if (error) {
    throw new Error("Could not load booking payment summaries.");
  }

  // A booking can have several attempts; its payment summary comes from the one
  // with the highest attempt number.
  const latestAttemptByBookingId = new Map();

  for (const attempt of data ?? []) {
    const latestSoFar = latestAttemptByBookingId.get(attempt.booking_id);

    if (!latestSoFar || attempt.attempt_number > latestSoFar.attempt_number) {
      latestAttemptByBookingId.set(attempt.booking_id, attempt);
    }
  }

  return latestAttemptByBookingId;
}
