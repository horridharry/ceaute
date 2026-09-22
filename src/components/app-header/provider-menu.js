// The provider menu: every entry is an independent provider-management
// section. Separators are scanning aids only; they are not groups, have no
// labels, and imply no parent/child relationship between the sections around
// them. The URL nesting of Portfolio under /dashboard/profile and of the two
// settings pages under /dashboard/settings is technical, not product structure.
//
// Pure data and functions (no React) so the order and matching can be tested.

export const PROVIDER_MENU = [
  { id: "home", label: "Home", href: "/dashboard", match: "exact" },
  { id: "bookings", label: "Bookings", href: "/dashboard/bookings" },
  { separator: true },
  { id: "availability", label: "Availability", href: "/dashboard/availability" },
  { id: "locations", label: "Locations", href: "/dashboard/locations" },
  { id: "treatments", label: "Treatments", href: "/dashboard/treatments" },
  {
    id: "treatment-groups",
    label: "Treatment groups",
    href: "/dashboard/treatment-groups",
  },
  { id: "add-ons", label: "Add-ons", href: "/dashboard/add-ons" },
  { separator: true },
  { id: "profile", label: "Profile", href: "/dashboard/profile", match: "exact" },
  {
    id: "portfolio",
    label: "Portfolio",
    href: "/dashboard/profile/portfolio",
  },
  { separator: true },
  {
    id: "booking-settings",
    label: "Booking settings",
    href: "/dashboard/settings/booking",
  },
  { id: "payments", label: "Payments", href: "/dashboard/settings/payments" },
];

export const PROVIDER_PREVIEW_HREF = "/dashboard/profile/preview";

function itemMatches(item, pathname) {
  if (item.match === "exact") {
    return pathname === item.href;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

// The id of the menu item for the current page, or null when the page is not
// one of the sections (the preview, onboarding, or anything unknown).
export function activeMenuItemId(pathname) {
  const path = String(pathname ?? "").replace(/\/+$/, "") || "/";
  const match = PROVIDER_MENU.find(
    (item) => !item.separator && itemMatches(item, path),
  );

  return match ? match.id : null;
}

// View your page: the live page once published, otherwise a preview that is
// clearly marked as not live. Always opened in the same tab.
export function viewYourPageHref({ status, username } = {}) {
  const name = String(username ?? "").trim();

  return status === "published" && name ? `/@${name}` : PROVIDER_PREVIEW_HREF;
}
