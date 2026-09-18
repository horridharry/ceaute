// A5. `publication-readiness.js` already computes the ten items the database
// enforces; nothing rendered them. This maps its `missing` labels onto the same
// ten items with somewhere to go and fix each one.
//
// The labels must match publication-readiness.js exactly — they are its
// output, not a second copy of the rules. The database is still the authority:
// publishing is checked by `publish_provider_page`, not by this list.
export const PUBLICATION_CHECKLIST = [
  { label: "Business name", title: "Business name", href: "/dashboard/profile" },
  { label: "Username", title: "Username", href: "/dashboard/profile" },
  { label: "Provider category", title: "Category", href: "/dashboard/profile" },
  { label: "Biography", title: "Bio", href: "/dashboard/profile" },
  {
    label: "Active location with public area and private address",
    title: "Location, public area and private address",
    href: "/dashboard/locations",
  },
  {
    label: "At least one enabled working day",
    title: "At least one working day",
    href: "/dashboard/availability",
  },
  {
    label: "At least one active treatment with category, price and duration",
    title: "One active treatment with category, price and duration",
    href: "/dashboard/treatments",
  },
  {
    label: "Booking settings with payment and cancellation terms",
    title: "Booking terms: payment and cancellation",
    href: "/dashboard/settings/booking",
  },
  {
    label: "At least one visible portfolio image",
    title: "One visible portfolio photo",
    href: "/dashboard/profile/portfolio",
  },
  {
    label: "Stripe payments ready",
    title: "Stripe payments ready",
    href: "/dashboard/settings/payments",
  },
];

export function buildPublicationChecklist(missing = []) {
  const missingLabels = new Set(missing);
  const items = PUBLICATION_CHECKLIST.map((item) => ({
    ...item,
    done: !missingLabels.has(item.label),
  }));

  return {
    items,
    doneCount: items.filter((item) => item.done).length,
    total: items.length,
  };
}
