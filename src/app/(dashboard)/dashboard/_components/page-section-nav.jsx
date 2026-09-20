"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";

const links = [
  { label: "Profile", href: "/dashboard/profile", exact: true },
  { label: "Portfolio", href: "/dashboard/profile/portfolio" },
  { label: "Availability", href: "/dashboard/availability" },
  { label: "Preview", href: "/dashboard/profile/preview" },
];

export function PageSectionNav() {
  const pathname = usePathname();

  return (
    <header className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tighter">Page</h1>
      <nav
        aria-label="Page settings"
        className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max items-center gap-5 border-b border-black/10">
          {links.map((link) => {
            const active = link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);

            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative block whitespace-nowrap border-b-2 pb-3 text-sm font-medium ${
                    active
                      ? "border-pink-600 text-black"
                      : "border-transparent text-black/55 hover:text-black"
                  }`}
                >
                  {link.label}
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
