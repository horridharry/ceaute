// The account menu and the Log in link. Pure data and functions (no React),
// like provider-menu.js, so the entries can be tested.

// "Me": the signed-in person. The provider menu is "my business".
// Approved 23 September 2026: a customer can start a business page from here,
// and a provider outside the workspace has a way back to it first.
export function personalMenuLinks({ hasProviderPage, isProviderWorkspace }) {
  if (hasProviderPage && isProviderWorkspace) {
    return [
      { label: "Account", href: "/account" },
      { label: "My bookings", href: "/account/bookings" },
      { label: "Discover", href: "/discover" },
    ];
  }

  if (hasProviderPage) {
    return [
      { label: "Your business", href: "/dashboard" },
      { label: "Discover", href: "/discover" },
      { label: "My bookings", href: "/account/bookings" },
      { label: "Account", href: "/account" },
    ];
  }

  return [
    { label: "Discover", href: "/discover" },
    { label: "My bookings", href: "/account/bookings" },
    { label: "Account", href: "/account" },
    { label: "Start your business page", href: "/dashboard/onboarding" },
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
