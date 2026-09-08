"use client";
import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { logoutUser } from "@/app/(authenticate)/actions";
export function DashboardNav() {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const isCurrentRoute = (routePath) =>
    pathname === routePath || pathname.startsWith(`${routePath}/`);

  const routes = [
    {
      name: "Dashboard",
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
      name: "Profile",
      path: "/provider/profile",
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
          <button
            onClick={() => logoutUser()}
            className="border-b p-2 hover:bg-red-100 hover:border-red-300 rounded- text-left text-sm text-red-600 font-medium mt-4 "
          >
            Sign out
          </button>
        </ul>
      </nav>
    </>
  );
}
