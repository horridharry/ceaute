"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/app/(authenticate)/actions";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PendingButton } from "@/components/pending-button";

const routes = [
  { name: "Overview", path: "/dashboard" },
  { name: "Bookings", path: "/dashboard/bookings" },
  { name: "Treatments", path: "/dashboard/treatments" },
  { name: "Treatment groups", path: "/dashboard/treatment-groups" },
  { name: "Add-ons", path: "/dashboard/add-ons" },
  { name: "Availability", path: "/dashboard/availability" },
  { name: "Locations", path: "/dashboard/locations" },
  { name: "Page", path: "/dashboard/profile" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);
  // Selecting a destination closes the menu straight away; the Link has
  // already started the client-side navigation by the time this runs.
  const closeNav = () => setNavOpen(false);

  const isCurrentRoute = (routePath) => {
    if (routePath === "/dashboard") {
      return pathname === routePath;
    }

    return pathname === routePath || pathname.startsWith(`${routePath}/`);
  };

  return (
    <>
      <section className="relative p-3 border-b flex">
        <button
          type="button"
          aria-expanded={navOpen}
          aria-controls="dashboard-nav"
          onClick={() => setNavOpen(!navOpen)}
          className="p-1 px-2 rounded-md hover:bg-black/5 flex gap-1 duration-200"
        >
          <Image src="/svg/menu.svg" alt="" width={18} height={18} />
          <p className="text-sm font-semibold">Menu</p>
        </button>
      </section>
      <nav
        id="dashboard-nav"
        aria-label="Dashboard"
        className={`${
          navOpen ? "block" : "hidden"
        } ml-auto duration-200 transition-all bg-white p-3`}
      >
        <ul className="grid inset-0 bg-white gap-4">
          {routes.map((route) => (
            <li key={route.path}>
              <Link
                href={route.path}
                onClick={closeNav}
                aria-current={isCurrentRoute(route.path) ? "page" : undefined}
                className={`${
                  isCurrentRoute(route.path) ? "font-semibold" : "font-normal"
                } block border-b p-2 hover:bg-black/5 text-sm`}
              >
                {route.name}
                <LinkPendingHint />
              </Link>
            </li>
          ))}
        </ul>

        <div className="mt-8 border-t pt-4">
          <Link
            href="/dashboard/settings"
            onClick={closeNav}
            aria-current={
              isCurrentRoute("/dashboard/settings") ? "page" : undefined
            }
            className={`${
              isCurrentRoute("/dashboard/settings")
                ? "font-semibold"
                : "font-normal"
            } block border-b p-2 text-sm hover:bg-black/5`}
          >
            Settings
            <LinkPendingHint />
          </Link>
          <form action={logoutUser}>
            <PendingButton
              pendingLabel="Signing out..."
              className="mt-4 w-full border-b p-2 text-left text-sm font-medium text-bad hover:border-bad/60 hover:bg-bad/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign out
            </PendingButton>
          </form>
        </div>
      </nav>
    </>
  );
}
