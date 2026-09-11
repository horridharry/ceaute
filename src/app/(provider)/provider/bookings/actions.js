"use server";
import { getSignedInProvider, minutesToDuration } from "../_lib/provider-data";

export const getAllBookings = async () => {
  const { supabase, providerPage } = await getSignedInProvider({
    next: "/provider/bookings",
  });

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, start_at, end_at, customer_snapshot, service_snapshot")
    .eq("provider_page_id", providerPage.id)
    .order("start_at", { ascending: true });

  if (error) {
    return [];
  }

  return bookings.map((booking) => {
    const startsAt = new Date(booking.start_at);
    const endsAt = new Date(booking.end_at);
    const durationMinutes = Math.max(0, Math.round((endsAt - startsAt) / 60000));
    const serviceSnapshot = booking.service_snapshot ?? {};

    return {
      booking_id: booking.id,
      customer_fullname: booking.customer_snapshot?.full_name ?? "Customer",
      booking_time: booking.start_at,
      duration: minutesToDuration(durationMinutes),
      treatments: {
        name: serviceSnapshot.treatment_name ?? "Treatment",
        duration: minutesToDuration(durationMinutes),
      },
    };
  });
};
