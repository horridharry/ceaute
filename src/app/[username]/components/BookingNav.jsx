"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";

export function BookingNav({ username }) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const currentPage = pathname.split("/")[2];

  const routes = [
    {
      name: "Dashboard",
      path: "/dashboard",
    },
    {
      name: "Bookings",
      path: "/dashboard/bookings",
    },
    {
      name: "Treatments",
      path: "/dashboard/treatments",
    },
    {
      name: "Availability",
      path: "/dashboard/availability",
    },
    {
      name: "Profile",
      path: "/dashboard/profile",
    },
  ];

  return (
    <section className="relative p-3 border-b flex">
      <Link
        href={`/@${username}`}
        className="p-1 px-2 rounded-md hover:bg-black/10 flex gap-1 duration-200"
      >
        <p className="text-sm font-semibold">{`@/${username}`}</p>
      </Link>
    </section>
  );
}
