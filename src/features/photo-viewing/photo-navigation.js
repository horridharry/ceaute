// Pure rules for viewing a list of photos, shared by the customer gallery
// and the provider's portfolio viewer. Photos are { id, image_url, caption }
// in portfolio order; ids are portfolio_image ids, never storage paths.

// The index of the photo with `id`, or null when there is no such photo
// (an invalid or stale ?photo= link).
export function photoIndexById(photos, id) {
  if (!id || !Array.isArray(photos)) {
    return null;
  }

  const index = photos.findIndex((photo) => photo.id === id);
  return index === -1 ? null : index;
}

// Previous/next stop at the ends rather than wrapping, so the position the
// viewer announces always moves in the direction the person chose.
export function stepPhotoIndex(index, delta, count) {
  if (!Number.isInteger(count) || count <= 0) {
    return null;
  }

  return Math.min(Math.max(index + delta, 0), count - 1);
}

// What a key press does in the full-screen viewer.
export function viewerKeyAction(key) {
  switch (key) {
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    case "Home":
      return "first";
    case "End":
      return "last";
    case "Escape":
      return "close";
    default:
      return null;
  }
}

// Tap versus swipe on a swipeable image. A pointer that moved more than a
// few pixels, or a track that scrolled while the pointer was down, was a
// swipe, and must not also open the photo.
export const TAP_SLOP_PX = 10;

export function isTap({ startX, startY, endX, endY, scrollDelta = 0 }) {
  if (![startX, startY, endX, endY].every(Number.isFinite)) {
    return false;
  }

  return (
    Math.abs(endX - startX) <= TAP_SLOP_PX &&
    Math.abs(endY - startY) <= TAP_SLOP_PX &&
    Math.abs(scrollDelta) <= TAP_SLOP_PX
  );
}

// Which photos the viewer gives a real src: the one in view and its
// neighbours. The rest wait, so opening the viewer never downloads every
// full-size image at once.
export const VIEWER_PRELOAD_RADIUS = 1;

export function shouldLoadViewerPhoto(index, current, radius = VIEWER_PRELOAD_RADIUS) {
  return Math.abs(index - current) <= radius;
}

// Masonry: every tile spans a whole number of small grid rows, so CSS grid
// auto-placement (row-major, no "dense") puts each photo in the first free
// spot from the top and left. That keeps the page in portfolio order as it
// is read, top to bottom and left to right, without stored image sizes.
export const MASONRY_ROW_PX = 4;
export const MASONRY_GAP_PX = 12;

export function masonryRowSpan(heightPx, rowPx = MASONRY_ROW_PX, gapPx = MASONRY_GAP_PX) {
  if (!Number.isFinite(heightPx) || heightPx <= 0) {
    return 1;
  }

  // The gap is folded into the rows (row-gap is 0), so tiles are separated by
  // exactly gapPx vertically.
  return Math.max(1, Math.ceil((heightPx + gapPx) / rowPx));
}

// The desktop "Bento" hero: one prominent photo and up to four supporting
// ones on a 4-column, 2-row grid. Returns the tiles to render, in portfolio
// order, with their grid placement.
export function bentoTiles(count) {
  const n = Math.min(Math.max(Number.isInteger(count) ? count : 0, 0), 5);

  const layouts = {
    0: [],
    1: ["col-span-4 row-span-2"],
    2: ["col-span-2 row-span-2", "col-span-2 row-span-2"],
    3: ["col-span-2 row-span-2", "col-span-2 row-span-1", "col-span-2 row-span-1"],
    4: [
      "col-span-2 row-span-2",
      "col-span-2 row-span-1",
      "col-span-1 row-span-1",
      "col-span-1 row-span-1",
    ],
    5: [
      "col-span-2 row-span-2",
      "col-span-1 row-span-1",
      "col-span-1 row-span-1",
      "col-span-1 row-span-1",
      "col-span-1 row-span-1",
    ],
  };

  return layouts[n].map((placement, index) => ({ index, placement }));
}

// The gallery URL for a provider, optionally opening a photo.
export function galleryHref(username, photoId) {
  const base = `/@${username}/photos`;
  return photoId ? `${base}?photo=${encodeURIComponent(photoId)}` : base;
}
