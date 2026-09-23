"use server";
import { revalidatePath } from "next/cache";
import { getSignedInProvider } from "../_lib/provider-data";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import {
  providerCancellationFailure,
  providerCancellationSuccess,
} from "./_lib/cancel-outcome";

// Cancels through the same database function and refund path as before (a
// provider cancellation refunds the full amount paid online). It reports the
// outcome to the confirmation dialog instead of throwing to the error page.
export const cancelProviderBooking = async (_currentState, formData) => {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const customerName = String(formData.get("customer_name") ?? "");

  if (!bookingId) {
    return { status: "error", message: "Choose a booking to cancel." };
  }

  const { supabase } = await getSignedInProvider({
    next: `/dashboard/bookings/${bookingId}`,
  });
  const paths = ["/dashboard/bookings", `/dashboard/bookings/${bookingId}`, "/dashboard"];

  try {
    await cancelBookingWithRefund({
      supabase,
      bookingId,
      actor: "provider",
      revalidatePaths: paths,
    });
  } catch (error) {
    console.error("[bookings] provider cancellation failed", {
      bookingId,
      message: error?.message,
    });
    // The booking may have been cancelled before a later step failed.
    for (const path of paths) revalidatePath(path);
    return providerCancellationFailure(error);
  }

  return providerCancellationSuccess(customerName);
};
