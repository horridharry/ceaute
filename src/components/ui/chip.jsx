import Link from "next/link";

// Chips — 02-components.md "Selection". A count appends to the label
// (`Toes 4`), it is never a separate badge. Chips wrap freely; they are not a
// scrolling rail.
//
// The specified 8px/13px padding draws a chip about 33px tall, under the 44px
// minimum tap target. Rather than inflate the chip, a transparent
// pseudo-element centred on it carries the hit area out to 44px. The drawn
// size and the row's layout are unchanged; only the reachable area grows, and
// it stays inside the 8px gap between wrapped rows so neighbours never overlap.
const CHIP_BASE =
  "relative inline-flex select-none items-center rounded-full px-[13px] py-2 text-[12.5px] font-medium transition duration-150 ease-out before:absolute before:inset-x-0 before:top-1/2 before:h-11 before:-translate-y-1/2 before:content-['']";

export function chipClassName({ selected = false, action = false, className = "" } = {}) {
  const variant = action
    ? "border border-plum/35 text-plum hover:border-plum/60"
    : selected
      ? "bg-ink text-white"
      : "border border-black/14 text-ink hover:border-black/30";

  return [CHIP_BASE, variant, className].filter(Boolean).join(" ");
}

export function Chip({
  label,
  count,
  selected = false,
  action = false,
  href,
  className = "",
  children,
  ...props
}) {
  const content = children ?? (
    <>
      {label}
      {count == null ? null : ` ${count}`}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        {...props}
        className={chipClassName({ selected, action, className })}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      {...props}
      className={chipClassName({ selected, action, className })}
    >
      {content}
    </button>
  );
}

export function ChipRow({ className = "", children }) {
  return (
    <div className={`flex flex-wrap gap-2 ${className}`.trim()}>{children}</div>
  );
}
