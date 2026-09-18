import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// A visible strip, not a hidden menu and not a floating pill. A provider works
// two-handed between clients — a strip she can see beats a menu she has to
// open. There is no bottom tab bar anywhere; this is a web app.
//
// Five items, down from an eight-item drawer: groups and add-ons are tabs
// inside Treatments, location and hours are tabs inside Page. On desktop the
// same five become a left column.
export const PROVIDER_NAV_ITEMS = [
  { value: "today", label: "Today", href: "/dashboard" },
  { value: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { value: "treatments", label: "Treatments", href: "/dashboard/treatments" },
  { value: "page", label: "Page", href: "/dashboard/profile" },
  { value: "settings", label: "Settings", href: "/dashboard/settings" },
];

// `responsive` is the product default: a scrolling strip on a phone, a left
// column from md up. The other two are for laying the component out on its
// own, such as the component gallery.
const ORIENTATIONS = {
  responsive: {
    nav: "flex-row overflow-x-auto border-b border-black/8 md:flex-col md:gap-1 md:overflow-visible md:border-b-0",
    item: "border-b-2 px-[9px] pb-3 pt-2.5 md:border-b-0 md:border-l-2 md:py-2 md:pl-3",
  },
  horizontal: {
    nav: "flex-row overflow-x-auto border-b border-black/8",
    item: "border-b-2 px-[9px] pb-3 pt-2.5",
  },
  vertical: {
    nav: "flex-col gap-1",
    item: "border-l-2 py-2 pl-3",
  },
};

export function ProviderNav({
  value,
  items = PROVIDER_NAV_ITEMS,
  orientation = "responsive",
  className = "",
}) {
  const layout = ORIENTATIONS[orientation] ?? ORIENTATIONS.responsive;

  return (
    <nav
      aria-label="Provider workspace"
      className={`flex gap-0.5 ${layout.nav} ${className}`.trim()}
    >
      {items.map((item) => {
        const active = item.value === value;

        return (
          <Link
            key={item.value}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 text-[13.5px] font-medium transition duration-150 ease-out ${layout.item} ${
              active
                ? "border-ink text-ink"
                : "border-transparent text-black/50 hover:text-ink"
            }`}
          >
            {item.label}
            <LinkPendingHint />
          </Link>
        );
      })}
    </nav>
  );
}
