// Read-only loaders for /account/bookings. Booking mutations live in
// ./actions.js.

import {
  describeInspirationImageAllowance,
  listBookingInspirationImages,
} from "@/lib/bookings/booking-inspiration-images";
import {
  bookingToDisplayBooking,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";
import { getLatestPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";
import { getSignedInCustomer } from "./_lib/customer-session";

export async function getCustomerBookings() {
  const { supabase } = await getSignedInCustomer("/account/bookings");

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_customer_booking_summaries");

  if (error) {
    throw new Error("Could not load customer bookings.");
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

export async function getCustomerBooking(bookingId) {
  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_customer_booking_summaries", {
      target_booking_id: bookingId,
    });

  if (error) {
    throw new Error("Could not load customer booking.");
  }

  const booking = bookings?.[0];

  if (!booking) {
    return null;
  }

  const [latestPaymentAttempts, reviewResult] = await Promise.all([
    getLatestPaymentAttemptsForBookings([booking.id]),
    supabase
      .schema("ceaute")
      .from("booking_review")
      .select("id, rating, comment, is_visible, created_at")
      .eq("booking_id", booking.id)
      .maybeSingle(),
  ]);

  if (reviewResult.error) {
    throw new Error("Could not load review details.");
  }

  const inspirationImages = await listBookingInspirationImages({
    supabase,
    bookingId: booking.id,
  });
  const displayBooking = bookingToDisplayBooking(
    booking,
    latestPaymentAttempts.get(booking.id),
  );

  return {
    ...displayBooking,
    review: reviewResult.data ?? null,
    inspiration_images: inspirationImages,
    inspiration_allowance: describeInspirationImageAllowance(
      inspirationImages.length,
    ),
    // Read-only once the appointment is history, and read-only for a hold: a
    // hold is managed on the checkout screen, which knows whether it has run
    // out. This screen has no expiry to check, and offering a control the
    // database would refuse is worse than not offering it.
    can_manage_inspiration_images: displayBooking.status === "confirmed",
  };
}
