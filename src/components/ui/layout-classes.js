// Class rules for the layout primitives, kept as plain functions so they are
// tested directly and so a page that cannot use the component (a layout that
// already renders the landmark) can still share the rule.
import { composeClassName } from "./class-names";

// Page widths Ceaute already uses. Each carries its own padding because the
// padding differs with the width.
const CONTAINER_WIDTHS = {
  // Most customer and dashboard pages.
  narrow: "max-w-md p-5",
  // Storefront sub-pages (All reviews, All treatments): the storefront's
  // column, narrowed and flush on wide screens.
  column: "max-w-md px-5 pb-10 pt-6 lg:max-w-[25.5rem] lg:px-0",
  // Portfolio management's photo grid: room for three columns on desktop.
  medium: "max-w-2xl p-5",
  // The photo gallery.
  wide: "max-w-5xl px-4 pb-10 pt-6 sm:px-5",
  // Legal text.
  prose: "max-w-2xl p-5 pb-16",
  // Sign-in, sign-up and verify: one centred card, vertically centred.
  auth: "flex min-h-screen max-w-sm items-center px-5 py-12",
};

// center is the convention. start keeps the left-aligned desktop placement of
// pages that have not been redesigned yet, so their loading state does not
// jump sideways when the page arrives.
const CONTAINER_ALIGN = {
  center: "mx-auto",
  start: "",
};

export const CONTAINER_WIDTH_NAMES = Object.keys(CONTAINER_WIDTHS);

export function containerClassName({ width = "narrow", align = "center", className = "" } = {}) {
  const widthClasses = CONTAINER_WIDTHS[width] ?? CONTAINER_WIDTHS.narrow;
  const alignClasses = CONTAINER_ALIGN[align] ?? CONTAINER_ALIGN.center;

  return composeClassName(
    ["container w-full min-w-0", alignClasses, widthClasses].filter(Boolean).join(" "),
    className,
  );
}

// lg is a page title (Bookings, Add-ons); md is a sub-page or card title
// (All reviews, "That page is not here"). tracking keeps the two letter
// spacings md headings already use.
const HEADING_SIZES = {
  lg: "text-3xl font-bold",
  md: "text-2xl font-bold",
};

const HEADING_TRACKING = {
  tighter: "tracking-tighter",
  tight: "tracking-tight",
};

export function headingClassName({ size = "lg", tracking = "tighter", className = "" } = {}) {
  return composeClassName(
    `${HEADING_SIZES[size] ?? HEADING_SIZES.lg} ${HEADING_TRACKING[tracking] ?? HEADING_TRACKING.tighter}`,
    className,
  );
}

// Card padding and radius travel together: the large card is the rounder
// one on the error pages.
const CARD_PADDING = {
  sm: "rounded-xl p-3",
  md: "rounded-xl p-4",
  lg: "rounded-2xl p-6",
};

// line is the convention. current draws the border in the text colour, which
// is what a bare `border` renders under Tailwind 4 and what the account
// bookings list has always shown; it is kept rather than silently changed.
const CARD_BORDER = {
  line: "border border-line",
  current: "border border-current",
};

const CARD_INTERACTIVE =
  "duration-200 motion-reduce:transition-none hover:border-line-strong hover:bg-surface-subtle";

export function cardClassName({
  padding = "md",
  border = "line",
  interactive = false,
  className = "",
} = {}) {
  return composeClassName(
    [
      CARD_PADDING[padding] ?? CARD_PADDING.md,
      CARD_BORDER[border] ?? CARD_BORDER.line,
      interactive ? CARD_INTERACTIVE : "",
    ]
      .filter(Boolean)
      .join(" "),
    className,
  );
}

// The link around a card carries the keyboard focus ring, rounded to match.
export function cardLinkClassName({ padding = "md", className = "" } = {}) {
  const radius = padding === "lg" ? "rounded-2xl" : "rounded-xl";

  return composeClassName(
    `block ${radius} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus`,
    className,
  );
}

export function emptyStateClassName({ variant = "inline", border = "line", className = "" } = {}) {
  const base =
    variant === "bounded"
      ? `${cardClassName({ padding: "md", border })} text-sm text-ink-muted`
      : "text-sm text-ink-muted";

  return composeClassName(base, className);
}

// The pulse only runs when the person has not asked for reduced motion.
export const SKELETON_PULSE = "motion-safe:animate-pulse";

export function skeletonClassName({ rounded = "xl", className = "" } = {}) {
  return composeClassName(
    `block ${rounded === "lg" ? "rounded-lg" : "rounded-xl"} bg-surface-subtle`,
    className,
  );
}
