import {
  bookingToDisplayBooking,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";
import { getLatestPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";

// The signed-in provider's booking summaries, grouped for display. Callers do
// their own signed-in check and pass the supabase client they already have.
export async function loadProviderBookingGroups(supabase) {
  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_provider_booking_summaries");

  if (error) {
    throw new Error("Could not load bookings.");
  }

  const latestPaymentAttempts = await getLatestPaymentAttemptsForBookings(
    (bookings ?? []).map((booking) => booking.id),
  );

  return groupBookingsByTiming(
    (bookings ?? []).map((booking) =>
      bookingToDisplayBooking(booking, latestPaymentAttempts.get(booking.id)),
    ),
  );
}
