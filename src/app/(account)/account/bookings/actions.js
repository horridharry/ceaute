"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import {
  addBookingInspirationImagesFromFiles,
  describeInspirationImageAllowance,
  listBookingInspirationImages,
  removeBookingInspirationImage,
} from "@/lib/bookings/booking-inspiration-images";
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

export async function addBookingInspirationImages(_currentState, formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    return "Could not add images to this booking.";
  }

  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );
  const message = await addBookingInspirationImagesFromFiles({
    supabase,
    bookingId,
    files: formData.getAll("image"),
  });

  revalidatePath(`/account/bookings/${bookingId}`);
  return message;
}

export async function removeBookingInspirationImageAction(
  _currentState,
  formData,
) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const imageId = String(formData.get("image_id") ?? "").trim();

  if (!bookingId || !imageId) {
    return "Could not remove that image.";
  }

  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );
  const result = await removeBookingInspirationImage({
    supabase,
    bookingId,
    imageId,
  });

  if (result.error) {
    return result.error;
  }

  revalidatePath(`/account/bookings/${bookingId}`);
  return "Image removed.";
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
}

export async function submitBookingReview(formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "");

  if (!bookingId || !Number.isInteger(rating)) {
    throw new Error("Choose a review rating.");
  }

  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );
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
