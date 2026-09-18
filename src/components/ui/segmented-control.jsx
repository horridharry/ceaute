import Link from "next/link";

// Two or three options in one row. The active segment is a white card inside a
// surface track — the one small shadow the system allows, because it has to
// read as raised within the track.
//
// Items are `{ value, label, href? }`. Give them an `href` in a server
// component; pass `onSelect` from a client component instead.
export function SegmentedControl({
  name = "segmented-control",
  items = [],
  value,
  onSelect,
  className = "",
}) {
  return (
    <div
      role={onSelect ? "group" : undefined}
      aria-label={name}
      className={`flex gap-1 rounded-row bg-surface p-[3px] ${className}`.trim()}
    >
      {items.map((item) => {
        const active = item.value === value;
        const segmentClassName = `flex-1 rounded-[9px] px-3 py-2 text-center text-[13px] font-medium transition duration-150 ease-out ${
          active ? "bg-white text-ink shadow-segment" : "text-black/50 hover:text-ink"
        }`;

        return item.href ? (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "true" : undefined}
            className={segmentClassName}
          >
            {item.label}
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect?.(item.value)}
            className={segmentClassName}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
