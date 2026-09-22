export const MAX_PAGINATION_DOTS = 5;

// The pagination dots to show for `count` images with `current` in view.
// Up to MAX_PAGINATION_DOTS dots are shown; beyond that a window of dots
// follows the current image, and a dot at the edge of the window is drawn
// small when more images lie past it. Every image stays reachable by
// swiping and the arrow keys; only the number of dots is limited, so the
// row never grows wider than MAX_PAGINATION_DOTS dots.
//
// Returns [{ index, size }] with size "active", "regular" or "small".
export function paginationDots({
  count,
  current,
  maxDots = MAX_PAGINATION_DOTS,
}) {
  if (!Number.isInteger(count) || count <= 1) {
    return [];
  }

  const active = Math.min(Math.max(current, 0), count - 1);
  const visible = Math.min(count, maxDots);
  const start = Math.min(
    Math.max(active - Math.floor(visible / 2), 0),
    count - visible,
  );
  const end = start + visible - 1;

  return Array.from({ length: visible }, (_, offset) => {
    const index = start + offset;
    let size = "regular";

    if (index === active) {
      size = "active";
    } else if ((index === start && start > 0) || (index === end && end < count - 1)) {
      size = "small";
    }

    return { index, size };
  });
}
