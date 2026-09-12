"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  bookingToDisplayBooking,
  getPaymentAttemptsForBookings,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";

function buildReturnPath(path) {
  return `/sign-in?next=${encodeURIComponent(path)}`;
}

async function getSignedInCustomer(next) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect(buildReturnPath(next));
  }

  return { supabase, userId };
}

export async function getCustomerBookings() {
  const { supabase, userId } = await getSignedInCustomer("/account/bookings");

  const { data: bookings, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, start_at, end_at, status, customer_snapshot, service_snapshot")
    .eq("customer_profile_id", userId)
    .order("start_at", { ascending: true });

  if (error) {
    throw new Error("Could not load customer bookings.");
  }

  const paymentAttempts = await getPaymentAttemptsForBookings(
    bookings.map((booking) => booking.id),
  );

  return groupBookingsByTiming(
    bookings.map((booking) =>
      bookingToDisplayBooking(booking, paymentAttempts.get(booking.id)),
    ),
  );
}

export async function getCustomerBooking(bookingId) {
  const { supabase, userId } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );

  const { data: booking, error } = await supabase
    .schema("ceaute")
    .from("booking")
    .select("id, start_at, end_at, status, customer_snapshot, service_snapshot")
    .eq("customer_profile_id", userId)
    .eq("id", bookingId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load customer booking.");
  }

  if (!booking) {
    return null;
  }

  const paymentAttempts = await getPaymentAttemptsForBookings([booking.id]);

  return bookingToDisplayBooking(booking, paymentAttempts.get(booking.id));
}

