import { getSignedInProvider } from "../_lib/provider-data";
import { listBookingInspirationImages } from "@/lib/bookings/booking-inspiration-images";
import { bookingToDisplayBooking, isProviderAppointment } from "@/lib/bookings/booking-display";
import { getPaidPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";
import { loadProviderBookingGroups } from "@/lib/bookings/provider-booking-groups";

export const getAllBookings = async () => {
  const { supabase } = await getSignedInProvider({
    next: "/dashboard/bookings",
  });

  return loadProviderBookingGroups(supabase);
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

  // A hold (unpaid, expired, or paid late and refunded automatically) is not
  // an appointment, so its detail URL is Not found like a missing booking.
  // The row itself is kept.
  if (!booking || !isProviderAppointment(booking)) {
    return null;
  }

  const [paidPaymentAttempts, inspirationImages] = await Promise.all([
    getPaidPaymentAttemptsForBookings([booking.id]),
    // Read only, and only for an appointment this provider was engaged for.
    // ceaute.can_view_booking_inspiration_images decides that, not this call.
    listBookingInspirationImages({ supabase, bookingId: booking.id }),
  ]);

  return {
    ...bookingToDisplayBooking(booking, paidPaymentAttempts.get(booking.id)),
    inspiration_images: inspirationImages,
  };
};
