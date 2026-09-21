"use server";

import { revalidatePath } from "next/cache";
import { cancelBookingWithRefund } from "@/lib/bookings/cancel-booking";
import {
  addBookingInspirationImagesFromFiles,
  removeBookingInspirationImage,
} from "@/lib/bookings/booking-inspiration-images";
import { getSignedInCustomer } from "./_lib/customer-session";

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
