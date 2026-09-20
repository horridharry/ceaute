"use client";

import { usePathname } from "next/navigation";
import { SectionTabs } from "./section-tabs";

const links = [
  { label: "Account", href: "/account/settings" },
  { label: "Booking settings", href: "/dashboard/settings/booking" },
  { label: "Payments", href: "/dashboard/settings/payments" },
];

export function SettingsSectionNav() {
  const pathname = usePathname();

  return (
    <header className="min-w-0">
      <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
      <SectionTabs
        ariaLabel="Settings"
        items={links.map((link) => ({
          label: link.label,
          href: link.href,
          active:
            pathname === link.href || pathname.startsWith(`${link.href}/`),
        }))}
      />
    </header>
  );
}
