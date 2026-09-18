import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// Tabs switch list content in place: 500/13, 18px gap, a 1.5px ink underline
// under the active tab, sitting on a hairline rule. Groups and add-ons are
// tabs inside Treatments; location and hours are tabs inside Page.
export function Tabs({ items = [], value, onSelect, className = "", label }) {
  return (
    <div
      role={onSelect ? "tablist" : undefined}
      aria-label={label}
      className={`flex gap-[18px] overflow-x-auto border-b border-black/8 ${className}`.trim()}
    >
      {items.map((item) => {
        const active = item.value === value;
        const tabClassName = `-mb-px shrink-0 border-b-[1.5px] pb-2.5 pt-1 text-[13px] font-medium transition duration-150 ease-out ${
          active ? "border-ink text-ink" : "border-transparent text-black/45 hover:text-ink"
        }`;

        return item.href ? (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={tabClassName}
          >
            {item.label}
            <LinkPendingHint />
          </Link>
        ) : (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect?.(item.value)}
            className={tabClassName}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
