"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";

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
      <nav
        aria-label="Catalogue"
        className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max items-center gap-5 border-b border-black/10">
          {sections.map((section) => {
            const active = section.href === activeSection.href;

            return (
              <li key={section.href}>
                <Link
                  href={section.href}
                  aria-current={active ? "page" : undefined}
                  className={`block whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                    active
                      ? "border-pink-600 text-black"
                      : "border-transparent text-black/55 hover:text-black"
                  }`}
                >
                  {section.label}
                  <LinkPendingHint />
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
