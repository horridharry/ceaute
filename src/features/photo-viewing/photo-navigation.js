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

// The gallery's Bento grid: 2 columns on phones and 4 from md up, every cell
// 4:5 (portrait, like most phone photos), and photos either one cell or a
// 2 x 2 block of the same shape, so a photo is never squeezed into a strip.
// Each photo gets a phone placement and an md placement. Both are chosen so
// that plain row-major auto-placement (no "dense") fills the grid in
// portfolio order: reading order, DOM order and keyboard order are the same.
//
// Phones repeat "one large, two small"; a final pair is two small, a final
// single is large. From md up, blocks of five (one large beside four small,
// the large side alternating) fill the grid; the remainder becomes two large
// side by side and/or a row of four small, so the grid has no holes. A lone
// photo, or one left after a pair of large ones (3 in all), is large and
// centred.
const PHONE_LARGE = "col-span-2 row-span-2";
const PHONE_SMALL = "col-span-1 row-span-1";
const WIDE_LARGE = "md:col-span-2 md:row-span-2";
const WIDE_SMALL = "md:col-span-1 md:row-span-1";
const WIDE_CENTRED = "md:col-span-2 md:row-span-2 md:col-start-2";

function wideBlocks(count) {
  if (count === 1) return ["centred"];
  if (count === 3) return ["pair", "centred"];

  const fives = Math.floor(count / 5);
  const blocks = (n) => Array.from({ length: n }, () => "five");
  switch (count % 5) {
    case 1:
      return [...blocks(fives - 1), "pair", "row"];
    case 2:
      return [...blocks(fives), "pair"];
    case 3:
      return [...blocks(fives - 1), "pair", "row", "pair"];
    case 4:
      return [...blocks(fives), "row"];
    default:
      return blocks(fives);
  }
}

function widePlacements(count) {
  let fives = 0;
  return wideBlocks(count).flatMap((block) => {
    if (block === "centred") return [WIDE_CENTRED];
    if (block === "pair") return [WIDE_LARGE, WIDE_LARGE];
    if (block === "row") return [WIDE_SMALL, WIDE_SMALL, WIDE_SMALL, WIDE_SMALL];
    const largeFirst = fives % 2 === 0;
    fives += 1;
    return largeFirst
      ? [WIDE_LARGE, WIDE_SMALL, WIDE_SMALL, WIDE_SMALL, WIDE_SMALL]
      : [WIDE_SMALL, WIDE_SMALL, WIDE_LARGE, WIDE_SMALL, WIDE_SMALL];
  });
}

function phonePlacement(index, count) {
  const endsWithPair = count % 3 === 2;
  if (endsWithPair && index >= count - 2) return PHONE_SMALL;
  return index % 3 === 0 ? PHONE_LARGE : PHONE_SMALL;
}

export function galleryBentoTiles(count) {
  const n = Math.max(Number.isInteger(count) ? count : 0, 0);
  const wide = widePlacements(n);
  return wide.map((widePlacement, index) => ({
    index,
    placement: `${phonePlacement(index, n)} ${widePlacement}`,
  }));
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
