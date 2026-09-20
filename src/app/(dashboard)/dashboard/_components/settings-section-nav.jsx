"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";

const links = [
  { label: "Account", href: "/account/settings" },
  { label: "Locations", href: "/dashboard/locations" },
  { label: "Booking settings", href: "/dashboard/settings/booking" },
  { label: "Payments", href: "/dashboard/settings/payments" },
];

export function SettingsSectionNav() {
  const pathname = usePathname();

  return (
    <header className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
      <nav
        aria-label="Settings"
        className="-mx-1 mt-5 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <ul className="flex min-w-max items-center gap-5 border-b border-black/10">
          {links.map((link) => {
            const active =
              pathname === link.href || pathname.startsWith(`${link.href}/`);

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
