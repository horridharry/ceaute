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

// A2's loader. Not a new query: it reuses the summaries above and splits the
// upcoming group into today and everything after, in Europe/London so "today"
// is her day rather than the server's. It lives here, beside the query,
// because the current time is read per request and a component may not.
const LONDON = "Europe/London";

function londonDateKey(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-CA", { timeZone: LONDON }).format(date);
}

export const getProviderDiary = async () => {
  const bookings = await getAllBookings();
  const upcoming = bookings.upcoming ?? [];
  const todayKey = londonDateKey(Date.now());

  return {
    todayLabel: new Intl.DateTimeFormat("en-GB", {
      timeZone: LONDON,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date()),
    today: upcoming.filter(
      (booking) => londonDateKey(booking.start_at) === todayKey,
    ),
    nextUp: upcoming.filter(
      (booking) => londonDateKey(booking.start_at) !== todayKey,
    ),
  };
};
