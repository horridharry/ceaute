"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { resolveRequestOrigin } from "@/lib/app/origin";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import { openCheckoutForOwnHold } from "@/lib/bookings/checkout-session";
import {
  addBookingInspirationImagesFromFiles,
  removeBookingInspirationImage,
} from "@/lib/bookings/booking-inspiration-images";
import { getSignedInCustomer } from "./_lib/customer-session";
import {
  customerCancellationFailure,
  customerCancellationSuccess,
  reviewFailure,
} from "./_lib/customer-outcomes";

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

// Returns the outcome for the confirmation dialog instead of throwing to the
// error page. The cancellation and its refund are decided by
// prepare_booking_cancellation, unchanged.
export async function cancelCustomerBooking(_currentState, formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    return { status: "error", message: "Choose a booking to cancel." };
  }

  const { supabase } = await getSignedInCustomer(
    `/account/bookings/${bookingId}`,
  );
  const paths = ["/account/bookings", `/account/bookings/${bookingId}`];

  try {
    const result = await cancelBookingWithRefund({
      supabase,
      bookingId,
      actor: "customer",
      revalidatePaths: paths,
    });

    return customerCancellationSuccess(result.refundAmountPence);
  } catch (error) {
    console.error("[bookings] customer cancellation failed", {
      bookingId,
      message: error?.message,
    });
    for (const path of paths) revalidatePath(path);
    return customerCancellationFailure(error);
  }
}

export async function submitBookingReview(_currentState, formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "");

  if (!bookingId) {
    return { status: "error", message: "We couldn’t save your review. Try again." };
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { status: "error", field: "rating", message: "Choose a rating from 1 to 5." };
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
    return reviewFailure(error);
  }

  revalidatePath(`/account/bookings/${bookingId}`);
  return { status: "saved", message: "Thanks. Your review is saved." };
}

// "Continue to payment" on a Finish booking card: the same claim path as the
// held page, which reuses an open Stripe Session.
export async function continueHoldPayment(formData) {
  const bookingId = String(formData.get("booking_id") ?? "").trim();

  if (!bookingId) {
    throw new Error("Could not start checkout.");
  }

  const { userId } = await getSignedInCustomer("/account/bookings");
  const origin = resolveRequestOrigin(await headers());
  redirect(await openCheckoutForOwnHold({ bookingId, profileId: userId, origin }));
}
