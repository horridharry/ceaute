// The provider's optional display photo: stored in its own private bucket,
// separate from Portfolio, under {provider_page_id}/{uuid}.{ext}. The database
// constraint on provider_page.display_photo_path requires exactly that shape
// (supabase/migrations/202609220001_add_provider_display_photo.sql).

export const DISPLAY_PHOTO_BUCKET = "provider-display-photos";
export const DISPLAY_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const EXTENSION_BY_TYPE = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export const DISPLAY_PHOTO_ACCEPT = [...EXTENSION_BY_TYPE.keys()].join(",");

function startsWith(bytes, signature, offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value);
}

// The image type named by the file's own first bytes, or null. The declared
// MIME type comes from the browser, so it is checked against this.
export function detectImageType(bytes) {
  if (!bytes || bytes.length < 12) {
    return null;
  }

  if (startsWith(bytes, [0xff, 0xd8, 0xff])) {
    return "image/jpeg";
  }

  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return "image/png";
  }

  // "RIFF" .... "WEBP"
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }

  return null;
}

// Why an upload cannot be used, or null when it can. `headBytes` are the
// file's first bytes (at least 12).
export function displayPhotoUploadError({ type, size, headBytes }) {
  if (!size) {
    return "Choose a photo to upload.";
  }

  if (!EXTENSION_BY_TYPE.has(type)) {
    return "Upload a JPEG, PNG or WebP image.";
  }

  if (size > DISPLAY_PHOTO_MAX_BYTES) {
    return "Photo must be 5 MB or smaller.";
  }

  if (detectImageType(headBytes) !== type) {
    return "That file is not a valid JPEG, PNG or WebP image.";
  }

  return null;
}

export function displayPhotoStoragePath({ providerPageId, photoId, type }) {
  return `${providerPageId}/${photoId}.${EXTENSION_BY_TYPE.get(type)}`;
}
