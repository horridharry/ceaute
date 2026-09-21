"use server";
import { getSignedInProvider } from "../_lib/provider-data";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";

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
