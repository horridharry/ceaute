// Inspiration images are private reference pictures a customer attaches to
// their own booking. Two screens need them — the checkout step before payment
// and the customer's booking details afterwards — so the work lives here and
// each route keeps a thin server action that authenticates and calls in.
//
// PostgreSQL and Supabase Storage decide who may do what. Everything in this
// file is the same rule stated early, so the customer gets a sentence instead
// of a constraint violation.

import { randomUUID } from "node:crypto";
import { signStoragePaths } from "@/lib/supabase/signed-urls";

export const INSPIRATION_IMAGE_BUCKET = "booking-inspiration-images";
export const INSPIRATION_IMAGE_LIMIT = 5;
export const MAX_INSPIRATION_IMAGE_BYTES = 10 * 1024 * 1024;

export const INSPIRATION_IMAGE_EXTENSIONS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const SIGNED_URL_SECONDS = 60 * 60;

// The one description of an acceptable file, so the client hint, the server
// action and the bucket's own limits cannot drift apart. Pure, so it is
// testable without a Supabase client.
export function describeInspirationImageFile(file) {
  if (!file || typeof file !== "object" || typeof file.size !== "number") {
    return { error: "Choose an image to upload." };
  }

  if (file.size === 0) {
    return { error: "Choose an image to upload." };
  }

  const contentType = String(file.type ?? "");

  if (!INSPIRATION_IMAGE_EXTENSIONS.has(contentType)) {
    return { error: "Upload a JPEG, PNG, or WebP image." };
  }

  if (file.size > MAX_INSPIRATION_IMAGE_BYTES) {
    return { error: "Each image must be 10 MB or smaller." };
  }

  return {
    contentType,
    extension: INSPIRATION_IMAGE_EXTENSIONS.get(contentType),
    byteSize: file.size,
  };
}

export function describeInspirationImageAllowance(imageCount) {
  const used = Number.isInteger(imageCount) ? Math.max(0, imageCount) : 0;

  return {
    used,
    limit: INSPIRATION_IMAGE_LIMIT,
    remaining: Math.max(0, INSPIRATION_IMAGE_LIMIT - used),
    isFull: used >= INSPIRATION_IMAGE_LIMIT,
  };
}

// Signed URLs rather than public ones: the bucket is private, and a link that
// stops working is the point.
export async function listBookingInspirationImages({ supabase, bookingId }) {
  const { data: images, error } = await supabase
    .schema("ceaute")
    .from("booking_inspiration_image")
    .select("id, storage_path, content_type, byte_size, created_at")
    .eq("booking_id", bookingId)
    .order("created_at", { ascending: true })
    .order("slot", { ascending: true });

  if (error) {
    throw new Error("Could not load inspiration images.");
  }

  const signedUrlByPath = await signStoragePaths(
    supabase,
    INSPIRATION_IMAGE_BUCKET,
    (images ?? []).map((image) => image.storage_path),
    SIGNED_URL_SECONDS,
  );

  return (images ?? []).map((image) => ({
    id: image.id,
    signed_url: signedUrlByPath.get(image.storage_path) ?? "",
    content_type: image.content_type,
  }));
}

export async function addBookingInspirationImage({ supabase, bookingId, file }) {
  const described = describeInspirationImageFile(file);

  if (described.error) {
    return { error: described.error };
  }

  const storagePath = `${bookingId}/${randomUUID()}.${described.extension}`;

  // Storage first. Its policies ask the same question the RPC does, so an
  // upload the customer is not entitled to make never reaches the table.
  const { error: uploadError } = await supabase.storage
    .from(INSPIRATION_IMAGE_BUCKET)
    .upload(storagePath, file, {
      contentType: described.contentType,
      upsert: false,
    });

  if (uploadError) {
    return { error: "Could not upload that image." };
  }

  const { error: recordError } = await supabase
    .schema("ceaute")
    .rpc("add_booking_inspiration_image", {
      target_booking_id: bookingId,
      target_storage_path: storagePath,
      target_content_type: described.contentType,
      target_byte_size: described.byteSize,
    });

  if (recordError) {
    // A file nothing points at is the one outcome the cleanup pass cannot see,
    // so it goes now rather than being left for later.
    await supabase.storage.from(INSPIRATION_IMAGE_BUCKET).remove([storagePath]);

    if (recordError.code === "23514") {
      return {
        error: `You can add up to ${INSPIRATION_IMAGE_LIMIT} inspiration images.`,
      };
    }

    return { error: "Could not save that image." };
  }

  return {};
}

function describeAdded(count) {
  if (count === 0) {
    return "";
  }

  return count === 1 ? "1 image added." : `${count} images added.`;
}

// Both screens offer the same control, so they report the same way: whatever
// was added is kept and said out loud, and the first file that could not be
// added explains itself rather than silently disappearing.
export async function addBookingInspirationImagesFromFiles({
  supabase,
  bookingId,
  files,
}) {
  const chosen = (files ?? []).filter(
    (file) => file && typeof file === "object" && file.size > 0,
  );

  if (chosen.length === 0) {
    return "Choose an image to upload.";
  }

  let added = 0;

  for (const file of chosen) {
    const result = await addBookingInspirationImage({
      supabase,
      bookingId,
      file,
    });

    if (result.error) {
      return [describeAdded(added), result.error].filter(Boolean).join(" ");
    }

    added += 1;
  }

  return describeAdded(added);
}

export async function removeBookingInspirationImage({
  supabase,
  bookingId,
  imageId,
}) {
  const { data: image, error: readError } = await supabase
    .schema("ceaute")
    .from("booking_inspiration_image")
    .select("id, storage_path")
    .eq("id", imageId)
    .eq("booking_id", bookingId)
    .maybeSingle();

  if (readError) {
    return { error: "Could not find that image." };
  }

  if (!image) {
    return { error: "That image is no longer attached to this booking." };
  }

  // The row goes first. Its delete policy is the authorization check, so a
  // customer who may not remove the image never reaches the file either.
  const { data: deleted, error: deleteError } = await supabase
    .schema("ceaute")
    .from("booking_inspiration_image")
    .delete()
    .eq("id", image.id)
    .eq("booking_id", bookingId)
    .select("id")
    .maybeSingle();

  if (deleteError || !deleted) {
    return { error: "This booking's images can no longer be changed." };
  }

  const { error: removeError } = await supabase.storage
    .from(INSPIRATION_IMAGE_BUCKET)
    .remove([image.storage_path]);

  if (removeError) {
    return { error: "The image was removed, but its file could not be deleted." };
  }

  return {};
}
