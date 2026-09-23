// Client-side checks for the portfolio screen. The server repeats every one
// of them; these only let the screen explain a refusal before asking.
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const PREVIEW_COUNT = 6;

export function describeFileProblem(file) {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return `Couldn’t add ${file.name}. Use JPEG, PNG or WebP up to 5 MB.`;
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `Couldn’t add ${file.name}. It’s larger than 5 MB.`;
  }
  return "";
}

// A live page keeps at least one visible photo: deleting or hiding the only
// visible one is refused, and the page is never unpublished instead.
export function isLastVisiblePhoto(images, image) {
  return image.is_visible && images.filter((candidate) => candidate.is_visible).length === 1;
}
