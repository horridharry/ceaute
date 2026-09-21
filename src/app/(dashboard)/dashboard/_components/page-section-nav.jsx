"use client";

import { usePathname } from "next/navigation";
import { SectionTabs } from "@/features/navigation/section-tabs";

const links = [
  { label: "Profile", href: "/dashboard/profile", exact: true },
  { label: "Portfolio", href: "/dashboard/profile/portfolio" },
  { label: "Availability", href: "/dashboard/availability" },
  { label: "Locations", href: "/dashboard/locations" },
  { label: "Preview", href: "/dashboard/profile/preview" },
];

export function PageSectionNav() {
  const pathname = usePathname();

  return (
    <header className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tighter">Page</h1>
      <SectionTabs
        ariaLabel="Page settings"
        items={links.map((link) => ({
          label: link.label,
          href: link.href,
          active: link.exact
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`),
        }))}
      />
    </header>
  );
}
