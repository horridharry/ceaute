"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/app/(authenticate)/actions";

export function ProviderNav() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const isCurrentRoute = (routePath) => {
    if (routePath === "/provider") {
      return pathname === routePath;
    }

    return pathname === routePath || pathname.startsWith(`${routePath}/`);
  };

  const routes = [
    {
      name: "Home",
      path: "/provider",
    },
    {
      name: "Bookings",
      path: "/provider/bookings",
    },
    {
      name: "Treatments",
      path: "/provider/treatments",
    },
    {
      name: "Availability",
      path: "/provider/availability",
    },
    {
      name: "My page",
      path: "/provider/page",
    },
  ];

  return (
    <>
      <section className="relative p-3 border-b flex">
        <button
          onClick={() => setNavOpen(!navOpen)}
          className="p-1 px-2 rounded-md hover:bg-black/5 flex gap-1 duration-200"
        >
          <Image src="/svg/menu.svg" alt="menu" width={18} height={18} />
          <p className="text-sm font-semibold">Menu</p>
        </button>
      </section>
      <nav
        aria-label="Provider workspace"
        className={`${
          navOpen ? "block" : "hidden"
        } ml-auto duration-200 transition-all bg-white p-3`}
      >
        <ul className="grid inset-0 bg-white gap-4">
          {routes.map((route) => (
            <Link key={route.path} href={`${route.path}`}>
              <li
                className={`${
                  isCurrentRoute(route.path)
                    ? "font-semibold"
                    : "font-normal"
                } border-b p-2 hover:bg-black/5 rounded- text-sm`}
              >
                {route.name}
              </li>
            </Link>
          ))}
        </ul>

        <div className="mt-8 border-t pt-4">
          <Link href="/provider/settings">
            <span
              className={`${
                isCurrentRoute("/provider/settings")
                  ? "font-semibold"
                  : "font-normal"
              } block border-b p-2 text-sm hover:bg-black/5`}
            >
              Settings
            </span>
          </Link>
          <button
            onClick={() => logoutUser()}
            className="mt-4 w-full border-b p-2 text-left text-sm font-medium text-red-600 hover:border-red-300 hover:bg-red-100"
          >
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
