"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";

const providerRoutes = [
  { name: "Today", href: "/dashboard", paths: ["/dashboard"] },
  {
    name: "Bookings",
    href: "/dashboard/bookings",
    paths: ["/dashboard/bookings"],
  },
  {
    name: "Treatments",
    href: "/dashboard/treatments",
    paths: [
      "/dashboard/treatments",
      "/dashboard/treatment-groups",
      "/dashboard/add-ons",
    ],
  },
  {
    name: "Page",
    href: "/dashboard/profile",
    paths: [
      "/dashboard/profile",
      "/dashboard/availability",
      "/dashboard/locations",
    ],
  },
  {
    name: "Settings",
    href: "/dashboard/settings",
    paths: ["/dashboard/settings", "/account/settings"],
  },
];

function routeIsActive(pathname, route) {
  return route.paths.some((path) =>
    path === "/dashboard"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

export function ProviderNavigation({ mobile = false }) {
  const pathname = usePathname();

  return (
    <ul
      className={
        mobile
          ? "flex min-w-max items-center gap-1 px-4"
          : "flex items-center gap-1"
      }
    >
      {providerRoutes.map((route) => {
        const active = routeIsActive(pathname, route);

        return (
          <li key={route.href}>
            <Link
              href={route.href}
              aria-current={active ? "page" : undefined}
              className={
                mobile
                  ? `relative block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                      active
                        ? "border-accent-600 text-black"
                        : "border-transparent text-black/55"
                    }`
                  : `relative rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-black/[0.04] hover:text-black ${
                      active ? "text-black" : "text-black/60"
                    }`
              }
            >
              {route.name}
              <LinkPendingHint />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
