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
  describeInspirationImageAllowance,
  listBookingInspirationImages,
  removeBookingInspirationImage,
} from "@/lib/bookings/booking-inspiration-images";
import { createClient } from "@/lib/supabase/server";

async function getSignedInCustomer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    throw new Error("Sign in to continue.");
  }

  return { supabase, profileId };
}

function readBookingId(formData) {
  return String(formData.get("booking_id") ?? "").trim();
}

// The screen the customer is standing on, without the hold and selection it
// carries: revalidatePath wants a route, not a URL.
function readCheckoutRoute(formData) {
  const returnPath = String(formData.get("return_path") ?? "").trim();

  return returnPath.startsWith("/@") ? returnPath.split("?")[0] : null;
}

// Nothing about this step may stand between the customer and paying. If the
// images cannot be loaded the checkout screen still has to render, with the
// payment button on it, so the failure is swallowed into an empty list rather
// than thrown up to the route's error boundary.
export async function getBookingInspirationImages(bookingId) {
  try {
    const { supabase } = await getSignedInCustomer();
    const images = await listBookingInspirationImages({ supabase, bookingId });

    return {
      images,
      allowance: describeInspirationImageAllowance(images.length),
      unavailable: false,
    };
  } catch {
    return {
      images: [],
      allowance: describeInspirationImageAllowance(0),
      unavailable: true,
    };
  }
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
