// The one place a button's look is defined. <Button> uses it, and a link
// that should look like a button calls buttonClassName() directly, so the
// two can never drift apart. Each variant keeps the colours the codebase
// already used for it (see docs/design-system.md); only focus, minimum size
// and reduced-motion behaviour were added when this moved here.
import { composeClassName } from "./class-names";

// Every variant: content centred on one line, a visible focus ring for
// keyboard users, and colour changes that stop under reduced motion.
const BASE =
  "inline-flex items-center justify-center gap-2 text-sm duration-200 motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANT_CLASSES = {
  // The pink-700 primary action shared by the dashboard forms.
  primary:
    "rounded-lg bg-action font-semibold text-white shadow-sm hover:bg-action-strong active:bg-action-strong disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
  // The deeper pink-800 fill of standalone page actions (the error pages and
  // sign-in), kept distinct from primary rather than merged into it.
  "primary-strong":
    "rounded-lg bg-action-strong font-medium text-white shadow-sm hover:opacity-80 active:opacity-80 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  // Outlined, pink text: the dashboard's second action.
  secondary:
    "rounded-lg border border-line font-semibold text-accent hover:border-line-strong active:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  // Outlined, neutral text: the storefront's full-width "See all" buttons.
  outline:
    "rounded-lg border border-ink/15 bg-surface font-semibold text-ink hover:bg-ink/[0.03] active:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  // Archive and remove actions.
  destructive:
    "rounded-lg font-semibold text-destructive hover:bg-destructive-surface/80 active:bg-destructive active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60",
  // A pink text action with no box, such as "Check my bookings".
  text: "rounded-lg font-semibold text-accent hover:text-accent-strong active:text-accent-strong disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50",
};

// md is the default and reaches a 44px target on its own. compact is for
// established dense rows and relies on the spacing around it; icon is a
// 44px square that must carry an aria-label.
const SIZE_CLASSES = {
  md: "min-h-11 px-4 py-3",
  compact: "px-3 py-2",
  icon: "h-11 w-11 shrink-0 p-0",
};

// A text action is sized by its target, not by a box around it.
const TEXT_SIZE_CLASSES = {
  md: "min-h-11",
  compact: "",
  icon: "h-11 w-11 shrink-0",
};

const FOCUS_CLASSES = {
  light: "focus-visible:outline-focus",
  // Over photos and the dark viewer the pink ring disappears; white does not.
  image: "focus-visible:outline-white",
};

export const BUTTON_VARIANTS = Object.keys(VARIANT_CLASSES);
export const BUTTON_SIZES = Object.keys(SIZE_CLASSES);

export function buttonClassName({
  variant = "primary",
  size = "md",
  surface = "light",
  className = "",
} = {}) {
  const variantClasses = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  const sizes = variant === "text" ? TEXT_SIZE_CLASSES : SIZE_CLASSES;
  const sizeClasses = sizes[size] ?? sizes.md;
  const focusClasses = FOCUS_CLASSES[surface] ?? FOCUS_CLASSES.light;

  return composeClassName(
    [BASE, variantClasses, sizeClasses, focusClasses].filter(Boolean).join(" "),
    className,
  );
}
