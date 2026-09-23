import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { selectPaidAttempt } from "./paid-attempt";

// Reads payment attempts with the privileged service-role client. Only pass IDs
// of bookings the caller has already loaded through an authorised booking query.
//
// Each booking maps to the attempt that took its money (see selectPaidAttempt);
// a booking nobody has paid for is absent from the map.
export async function getPaidPaymentAttemptsForBookings(bookingIds) {
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

  const attemptsByBookingId = new Map();

  for (const attempt of data ?? []) {
    const attempts = attemptsByBookingId.get(attempt.booking_id) ?? [];
    attempts.push(attempt);
    attemptsByBookingId.set(attempt.booking_id, attempts);
  }

  const paidAttemptByBookingId = new Map();

  for (const [bookingId, attempts] of attemptsByBookingId) {
    const paidAttempt = selectPaidAttempt(attempts);

    if (paidAttempt) {
      paidAttemptByBookingId.set(bookingId, paidAttempt);
    }
  }

  return paidAttemptByBookingId;
}

// The hold fields the customer booking summaries do not return: when a hold
// ends, and its treatment (for the held page's address). Same rule: only IDs
// of the caller's own bookings, already loaded through an authorised query.
export async function getHoldDetailsForBookings(bookingIds) {
  if (!bookingIds.length) {
    return new Map();
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, treatment_id, expires_at")
    .in("id", bookingIds);

  if (error) {
    throw new Error("Could not load booking holds.");
  }

  return new Map((data ?? []).map((row) => [row.id, row]));
}
