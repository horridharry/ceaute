"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { SectionTabs } from "./section-tabs";

const links = [
  { label: "Profile", href: "/dashboard/profile", exact: true },
  { label: "Portfolio", href: "/dashboard/profile/portfolio" },
  { label: "Availability", href: "/dashboard/availability" },
  { label: "Locations", href: "/dashboard/locations" },
  { label: "Preview", href: "/dashboard/profile/preview" },
];

export function PageSectionNav({ action = null }) {
  const pathname = usePathname();

  return (
    <header className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tighter">Page</h1>
        {action ? (
          <Link
            href={action.href}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-accent-600 hover:bg-accent-50"
          >
            {action.label}
            <LinkPendingHint />
          </Link>
        ) : null}
      </div>
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
