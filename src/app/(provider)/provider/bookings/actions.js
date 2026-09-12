"use server";
import { getSignedInProvider } from "../_lib/provider-data";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import {
  bookingToDisplayBooking,
  getPaymentAttemptsForBookings,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";

export const getAllBookings = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/bookings",
  });

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, start_at, end_at, status, cancelled_at, cancelled_by, cancellation_refund_pence, cancellation_retained_pence, customer_snapshot, service_snapshot",
    )
    .eq("provider_page_id", providerPage.id)
    .order("start_at", { ascending: true });

  if (error) {
    return [];
  }

  const paymentAttempts = await getPaymentAttemptsForBookings(
    bookings.map((booking) => booking.id),
  );

  return groupBookingsByTiming(
    bookings.map((booking) =>
      bookingToDisplayBooking(booking, paymentAttempts.get(booking.id)),
    ),
  );
};

export const getProviderBooking = async (bookingId) => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: `/provider/bookings/${bookingId}`,
  });

  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select(
      "id, start_at, end_at, status, cancelled_at, cancelled_by, cancellation_refund_pence, cancellation_retained_pence, customer_snapshot, service_snapshot",
    )
    .eq("provider_page_id", providerPage.id)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load booking.");
  }

  if (!booking) {
    return null;
  }

  const paymentAttempts = await getPaymentAttemptsForBookings([booking.id]);

  return bookingToDisplayBooking(booking, paymentAttempts.get(booking.id));
};

export const cancelProviderBooking = async (formData) => {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    throw new Error("Could not cancel booking.");
  }

  const { supabase } = await getSignedInProvider({
    next: `/provider/bookings/${bookingId}`,
  });

  await cancelBookingWithRefund({
    supabase,
    bookingId,
    actor: "provider",
    revalidatePaths: ["/provider/bookings", `/provider/bookings/${bookingId}`],
  });
};
