"use client";

import { usePathname } from "next/navigation";
import { ProviderNav } from "@/components/ui/provider-nav";

// B7: the eight-item drawer becomes the five-item visible strip. A provider
// works two-handed between clients — a strip she can see beats a menu she has
// to open.
//
// The three sections that disappeared are not gone, they moved: groups and
// add-ons are reached from Treatments, location and working hours from Page.
// Sign out moved to the avatar menu in the top bar, which every dashboard
// screen now carries.
const SECTION_BY_PREFIX = [
  ["/dashboard/bookings", "bookings"],
  ["/dashboard/treatments", "treatments"],
  ["/dashboard/treatment-groups", "treatments"],
  ["/dashboard/add-ons", "treatments"],
  ["/dashboard/profile", "page"],
  ["/dashboard/locations", "page"],
  ["/dashboard/availability", "page"],
  ["/dashboard/settings", "settings"],
];

export function activeProviderSection(pathname) {
  if (pathname === "/dashboard") return "today";

  const match = SECTION_BY_PREFIX.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  return match ? match[1] : null;
}

export function DashboardNav() {
  const pathname = usePathname();

  // Onboarding is the one dashboard URL reachable before a provider page
  // exists, and every other section redirects back to it until one does.
  // Offering the strip there would be five links to the same screen.
  if (pathname === "/dashboard/onboarding") {
    return null;
  }

  return <ProviderNav value={activeProviderSection(pathname)} />;
}
