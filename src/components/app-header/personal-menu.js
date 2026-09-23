// The account menu and the Log in link. Pure data and functions (no React),
// like provider-menu.js, so the entries can be tested.

// "Me": the signed-in person. The provider menu is "my business".
// Approved 23 September 2026: every signed-in account sees the same rows in
// the same places (Account, My bookings, Discover), then one business slot
// (Your business, or Start your business page for a customer), then Log out,
// which the menu adds itself. The row for the area you are in is marked
// current.
function isWithin(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function personalMenuLinks({ hasProviderPage, pathname = "" }) {
  const path = String(pathname ?? "");
  const inMyBookings = isWithin(path, "/account/bookings");
  const business = hasProviderPage
    ? { label: "Your business", href: "/dashboard", current: isWithin(path, "/dashboard") }
    : {
        label: "Start your business page",
        href: "/dashboard/onboarding",
        current: isWithin(path, "/dashboard/onboarding"),
      };

  return [
    { label: "Account", href: "/account", current: isWithin(path, "/account") && !inMyBookings },
    { label: "My bookings", href: "/account/bookings", current: inMyBookings },
    { label: "Discover", href: "/discover", current: isWithin(path, "/discover") },
    { ...business, separatorBefore: true },
  ];
}

// Log in brings the person back to the page they were on. The auth pages
// themselves are not somewhere to come back to.
export function signInHref(pathname) {
  const path = String(pathname ?? "");

  if (!path || path === "/" || /^\/(sign-in|sign-up|verify|auth)(\/|$)/.test(path)) {
    return "/sign-in";
  }

  return `/sign-in?next=${encodeURIComponent(path)}`;
}
