// Class rules for filter pills, shared by the link and toggle variants and by
// the storefront's treatment-group filter (approved in storefront Stage 4).
import { composeClassName } from "./class-names";

// On a narrow screen the row scrolls sideways on its own rather than widening
// the page; from sm it wraps.
export const FILTER_PILL_ROW =
  "-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden";

const PILL_BASE =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600";

export function filterPillClassName({ selected = false, className = "" } = {}) {
  return composeClassName(
    `${PILL_BASE} ${
      selected
        ? "border-black bg-black text-white"
        : "border-black/15 bg-white text-black hover:bg-black/[0.03]"
    }`,
    className,
  );
}
