import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// Buttons — 02-components.md "Buttons". Height 48, radius 11, label 500/14.5.
//
// One primary per screen: it is the thing the screen is for. A primary that
// commits (Book, Pay, Save, Hold) belongs in <CommitBar>; a primary that only
// navigates sits inline.
const VARIANTS = {
  primary: "bg-plum font-semibold text-white hover:bg-plum-hover",
  secondary: "bg-ink text-white hover:bg-ink/90",
  tertiary: "border border-black/16 text-ink hover:border-black/30",
  destructive: "border border-bad/35 text-bad hover:border-bad/60",
  // A red fill is allowed in exactly one place: the final confirm inside a
  // cancel flow. Every other destructive action is the outline above.
  "destructive-confirm": "bg-bad font-semibold text-white hover:bg-bad/90",
};

const BASE =
  "inline-flex h-12 select-none items-center justify-center gap-2 rounded-control px-4 text-center text-body-strong transition duration-150 ease-out disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40";

export function buttonClassName({
  variant = "primary",
  block = true,
  className = "",
} = {}) {
  return [BASE, block ? "w-full" : "", VARIANTS[variant] ?? VARIANTS.primary, className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant = "primary",
  block = true,
  type = "button",
  className,
  children,
  ...buttonProps
}) {
  return (
    <button
      type={type}
      {...buttonProps}
      className={buttonClassName({ variant, block, className })}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  block = true,
  className,
  children,
  ...linkProps
}) {
  return (
    <Link
      href={href}
      {...linkProps}
      className={buttonClassName({ variant, block, className })}
    >
      {children}
      <LinkPendingHint />
    </Link>
  );
}

// Two actions of equal weight. Each child takes half the row.
export function ButtonPair({ className = "", children }) {
  return (
    <div className={`flex gap-2 *:flex-1 ${className}`.trim()}>{children}</div>
  );
}

// Quiet exits — "Keep booking", "Not yet". No border, never the way out of a
// destructive confirmation on its own.
export function TextButton({ className = "", children, type = "button", ...props }) {
  return (
    <button
      type={type}
      {...props}
      className={`inline-flex min-h-11 items-center justify-center px-2 text-[13.5px] font-medium text-black/60 transition duration-150 ease-out hover:text-ink disabled:opacity-40 ${className}`.trim()}
    >
      {children}
    </button>
  );
}

// A link inside a sentence or a row. Plum, 500/13, never underlined.
export function InlineLink({ href, className = "", children, ...props }) {
  return (
    <Link
      href={href}
      {...props}
      className={`text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover ${className}`.trim()}
    >
      {children}
      <LinkPendingHint />
    </Link>
  );
}
