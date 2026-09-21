"use server";

// The optional inspiration step of the booking journey, which sits on the held
// booking's checkout screen between the summary and the payment button.
//
// These are deliberately beside `actions.js` rather than inside it: that module
// owns holding a slot and paying for it, and nothing here may ever become a
// condition of either. A customer can ignore this step entirely.
//
// Every authorization decision is made by PostgreSQL and Supabase Storage. What
// these actions add is a signed-in customer and a screen to refresh.

import { revalidatePath } from "next/cache";
import {
  addBookingInspirationImagesFromFiles,
  removeBookingInspirationImage,
} from "@/lib/bookings/booking-inspiration-images";
import { getSignedInCustomer } from "./_lib/signed-in-customer";

function readBookingId(formData) {
  return String(formData.get("booking_id") ?? "").trim();
}

// The screen the customer is standing on, without the hold and selection it
// carries: revalidatePath wants a route, not a URL.
function readCheckoutRoute(formData) {
  const returnPath = String(formData.get("return_path") ?? "").trim();

  return returnPath.startsWith("/@") ? returnPath.split("?")[0] : null;
}

export async function addBookingImagesDuringCheckout(_currentState, formData) {
  const { supabase } = await getSignedInCustomer();
  const bookingId = readBookingId(formData);
  const checkoutRoute = readCheckoutRoute(formData);

  if (!bookingId) {
    return "Could not add images to this booking.";
  }

  const message = await addBookingInspirationImagesFromFiles({
    supabase,
    bookingId,
    files: formData.getAll("image"),
  });

  if (checkoutRoute) {
    revalidatePath(checkoutRoute);
  }

  return message;
}

export async function removeBookingImageDuringCheckout(
  _currentState,
  formData,
) {
  const { supabase } = await getSignedInCustomer();
  const bookingId = readBookingId(formData);
  const imageId = String(formData.get("image_id") ?? "").trim();
  const checkoutRoute = readCheckoutRoute(formData);

  if (!bookingId || !imageId) {
    return "Could not remove that image.";
  }

  const result = await removeBookingInspirationImage({
    supabase,
    bookingId,
    imageId,
  });

  if (result.error) {
    return result.error;
  }

  if (checkoutRoute) {
    revalidatePath(checkoutRoute);
  }

  return "Image removed.";
}
