"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { SectionTabs } from "./section-tabs";

const sections = [
  {
    label: "Treatments",
    href: "/dashboard/treatments",
    newHref: "/dashboard/treatments/new",
  },
  {
    label: "Groups",
    href: "/dashboard/treatment-groups",
    newHref: "/dashboard/treatment-groups/new",
  },
  {
    label: "Add-ons",
    href: "/dashboard/add-ons",
    newHref: "/dashboard/add-ons/new",
  },
];

export function CatalogueSectionNav() {
  const pathname = usePathname();
  const activeSection =
    sections.find(
      (section) =>
        pathname === section.href || pathname.startsWith(`${section.href}/`),
    ) ?? sections[0];

  return (
    <header className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tighter">Catalogue</h1>
        <Link
          href={activeSection.newHref}
          className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
        >
          + New
          <LinkPendingHint />
        </Link>
      </div>
      <SectionTabs
        ariaLabel="Catalogue"
        items={sections.map((section) => ({
          label: section.label,
          href: section.href,
          active: section.href === activeSection.href,
        }))}
      />
    </header>
  );
}
