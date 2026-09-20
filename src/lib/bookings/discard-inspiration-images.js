// Entering the booking flow and walking away must not leave files behind. A
// booking that dies before it is ever paid for takes its inspiration images
// with it, and this is the half of that PostgreSQL cannot do: deleting a
// Storage object is an HTTP call.
//
// It runs from the scheduled route that already owns booking lifecycle
// maintenance rather than from a mechanism of its own, and it is replay-safe
// like the rest of the scheduled work: the files go first, so a crash in the
// middle leaves a row that the next pass retries, never a file nothing
// remembers. Removing an object that is already gone succeeds.

import { INSPIRATION_IMAGE_BUCKET } from "@/lib/bookings/booking-inspiration-images";

export async function discardAbandonedInspirationImages({
  supabase,
  maxImages = 500,
}) {
  const { data: images, error: listError } = await supabase
    .schema("ceaute")
    .rpc("list_discardable_booking_inspiration_images", {
      max_images: maxImages,
    });

  if (listError) {
    throw new Error("Could not list discardable inspiration images.");
  }

  if (!images?.length) {
    return { discarded: 0 };
  }

  // Sweep each dead booking's whole folder rather than only the paths that have
  // a row. An object can exist without one — an upload whose record failed, or
  // a customer who called Storage directly with the token their browser already
  // holds — and a file nothing points at would otherwise never be found again.
  const bookingIds = [...new Set(images.map((image) => image.booking_id))];
  const paths = new Set(images.map((image) => image.storage_path));

  for (const bookingId of bookingIds) {
    const { data: objects, error: folderError } = await supabase.storage
      .from(INSPIRATION_IMAGE_BUCKET)
      .list(bookingId, { limit: 1000 });

    if (folderError) {
      throw new Error("Could not list abandoned inspiration image files.");
    }

    for (const object of objects ?? []) {
      paths.add(`${bookingId}/${object.name}`);
    }
  }

  const { error: removeError } = await supabase.storage
    .from(INSPIRATION_IMAGE_BUCKET)
    .remove([...paths]);

  if (removeError) {
    throw new Error("Could not remove abandoned inspiration image files.");
  }

  // The database re-checks that each image still belongs to a booking that was
  // never paid for, so an image that became part of a confirmed booking between
  // the list above and this call is kept rather than forgotten.
  const { data: discarded, error: discardError } = await supabase
    .schema("ceaute")
    .rpc("discard_booking_inspiration_images", {
      target_image_ids: images.map((image) => image.id),
    });

  if (discardError) {
    throw new Error("Could not discard abandoned inspiration images.");
  }

  return { discarded: Number(discarded ?? 0) };
}
