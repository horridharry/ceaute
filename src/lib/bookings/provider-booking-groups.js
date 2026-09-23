import {
  bookingToDisplayBooking,
  groupProviderBookings,
} from "@/lib/bookings/booking-display";
import { getLatestPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";

// The signed-in provider's appointments, grouped Upcoming / Completed /
// Cancelled. get_provider_booking_summaries returns every booking row of the
// page, holds included; groupProviderBookings drops the holds here, on the
// server, so no list or count a provider sees includes them. Callers do
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

  const groups = groupProviderBookings(
    (bookings ?? []).map((booking) =>
      bookingToDisplayBooking(booking, latestPaymentAttempts.get(booking.id)),
    ),
  );

  const inspirationCounts = await countInspirationImages(
    supabase,
    [...groups.upcoming, ...groups.completed].map((booking) => booking.id),
  );

  for (const booking of [...groups.upcoming, ...groups.completed, ...groups.cancelled]) {
    booking.inspiration_image_count = inspirationCounts.get(booking.id) ?? 0;
  }

  return groups;
}

// How many inspiration photos each appointment has, for the "2 inspiration
// photos" line on list rows. Row-level security
// (can_view_booking_inspiration_images) decides which the provider may see.
async function countInspirationImages(supabase, bookingIds) {
  const counts = new Map();

  if (bookingIds.length === 0) {
    return counts;
  }

  const { data, error } = await supabase
    .schema("ceaute")
    .from("booking_inspiration_image")
    .select("booking_id")
    .in("booking_id", bookingIds);

  if (error) {
    return counts;
  }

  for (const row of data ?? []) {
    counts.set(row.booking_id, (counts.get(row.booking_id) ?? 0) + 1);
  }

  return counts;
}
