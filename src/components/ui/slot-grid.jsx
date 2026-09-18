import Link from "next/link";

// Three per row. Only bookable starts appear: a start that cannot fit the
// treatment's duration before closing time is simply absent, with no
// explanatory caption — the absence is the explanation.
export function SlotGrid({ slots = [], value, onSelect, className = "" }) {
  return (
    <div className={`grid grid-cols-3 gap-2 ${className}`.trim()}>
      {slots.map((slot) => {
        const selected = slot.value === value;
        const cellClassName = `rounded-control py-3.5 text-center text-[15px] font-medium transition duration-150 ease-out ${
          selected ? "bg-ink text-white" : "border border-black/12 text-ink hover:border-black/30"
        }`;

        return slot.href ? (
          <Link
            key={slot.value}
            href={slot.href}
            aria-current={selected ? "true" : undefined}
            className={cellClassName}
          >
            {slot.label}
          </Link>
        ) : (
          <button
            key={slot.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onSelect?.(slot.value)}
            className={cellClassName}
          >
            {slot.label}
          </button>
        );
      })}
    </div>
  );
}
