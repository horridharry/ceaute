"use server";
import { getSignedInProvider } from "../_lib/provider-data";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import {
  bookingToDisplayBooking,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";
import { getLatestPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";

export const getAllBookings = async () => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/bookings",
  });

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
};

export const getProviderBooking = async (bookingId) => {
  const { supabase } = await getSignedInProvider({
    next: `/dashboard/bookings/${bookingId}`,
  });

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .rpc("get_provider_booking_summaries", {
      target_booking_id: bookingId,
    });

  if (error) {
    throw new Error("Could not load booking.");
  }

  const booking = bookings?.[0];

  if (!booking) {
    return null;
  }

  const latestPaymentAttempts = await getLatestPaymentAttemptsForBookings([
    booking.id,
  ]);

  return bookingToDisplayBooking(booking, latestPaymentAttempts.get(booking.id));
};

export const cancelProviderBooking = async (formData) => {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    throw new Error("Could not cancel booking.");
  }

  const { supabase } = await getSignedInProvider({
    next: `/dashboard/bookings/${bookingId}`,
  });

  await cancelBookingWithRefund({
    supabase,
    bookingId,
    actor: "provider",
    revalidatePaths: ["/dashboard/bookings", `/dashboard/bookings/${bookingId}`],
  });
};
