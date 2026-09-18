"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import { createClient } from "@/lib/supabase/server";
import {
  bookingToDisplayBooking,
  groupBookingsByTiming,
} from "@/lib/bookings/booking-display";
import { getLatestPaymentAttemptsForBookings } from "@/lib/bookings/booking-payment-attempts";

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

  return {
    ...bookingToDisplayBooking(booking, latestPaymentAttempts.get(booking.id)),
    review: reviewResult.data ?? null,
  };
}

export async function cancelCustomerBooking(formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    throw new Error("Could not cancel booking.");
  }

  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );

  await cancelBookingWithRefund({
    supabase,
    bookingId,
    actor: "customer",
    revalidatePaths: ["/account/bookings", `/account/bookings/${bookingId}`],
  });

  // Navigation only: the cancellation and refund work above is unchanged. The
  // redirect lands on the cancelled letter, which states the refund outcome as
  // the first thing she reads.
  redirect(`/account/bookings/${bookingId}?cancelled=1`);
}

export async function submitBookingReview(formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "");

  if (!bookingId || !Number.isInteger(rating)) {
    throw new Error("Choose a review rating.");
  }

  const { supabase } = await getSignedInCustomer(`/account/bookings/${bookingId}`);
  const { error } = await supabase.schema("ceaute").rpc("create_booking_review", {
    target_booking_id: bookingId,
    review_rating: rating,
    review_comment: comment,
  });

  if (error) {
    throw new Error(error.message || "Could not save review.");
  }

  revalidatePath(`/account/bookings/${bookingId}`);
}
