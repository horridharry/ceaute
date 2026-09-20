"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import posthog from "posthog-js";
import { logoutUser } from "@/app/(authenticate)/actions";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PendingButton } from "@/components/pending-button";

const hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/verify", "/auth"];

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
    paths: [
      "/dashboard/settings",
      "/account/settings",
    ],
  },
];

const focusedProviderRoutePatterns = [
  /^\/dashboard\/treatments\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/treatment-groups\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/add-ons\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/locations\/(?:new|[^/]+\/edit)$/,
];

function routeIsActive(pathname, route) {
  return route.paths.some((path) =>
    path === "/dashboard"
      ? pathname === path
      : pathname === path || pathname.startsWith(`${path}/`),
  );
}

function HomeLogo({ href = "/" }) {
  return (
    <Link href={href} className="text-xl font-semibold tracking-tighter">
      Ceaute
    </Link>
  );
}

function HeaderLink({ href, children, exact = false }) {
  const pathname = usePathname();
  const isActive = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={isActive ? "page" : undefined}
      className={`relative rounded-full px-3 py-1.5 text-sm font-medium transition hover:bg-black/[0.04] hover:text-black ${
        isActive ? "text-black" : "text-black/60"
      }`}
    >
      {children}
      <LinkPendingHint />
    </Link>
  );
}

function ProviderNavigation({ mobile = false }) {
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
                        ? "border-pink-600 text-black"
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

function AccountMenu({ user, providerPage }) {
  const [open, setOpen] = useState(false);
  const hasProviderPage = Boolean(providerPage);
  const closeMenu = () => setOpen(false);
  const logout = async () => {
    posthog.reset();
    await logoutUser();
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="grid h-10 w-10 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700 transition hover:bg-pink-200"
      >
        {user.name.slice(0, 1).toUpperCase()}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-lg"
        >
          {hasProviderPage ? (
            <>
              <Link
                href="/dashboard"
                role="menuitem"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/[0.04]"
              >
                Dashboard
                <LinkPendingHint />
              </Link>
              <Link
                href="/account/bookings"
                role="menuitem"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/[0.04]"
              >
                Bookings
                <LinkPendingHint />
              </Link>
              <Link
                href="/account"
                role="menuitem"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/[0.04]"
              >
                Account
                <LinkPendingHint />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/account/bookings"
                role="menuitem"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/[0.04]"
              >
                Bookings
                <LinkPendingHint />
              </Link>
              <Link
                href="/account"
                role="menuitem"
                onClick={closeMenu}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-black/[0.04]"
              >
                Account
                <LinkPendingHint />
              </Link>
            </>
          )}

          <form action={logout} className="mt-2 border-t border-black/10 pt-2">
            <PendingButton
              role="menuitem"
              pendingLabel="Logging out..."
              className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Log out
            </PendingButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function AppHeaderClient({ user, providerPage = null }) {
  const pathname = usePathname();
  const isProviderWorkspace = Boolean(
    user &&
      providerPage &&
      (pathname.startsWith("/dashboard") || pathname === "/account/settings"),
  );

  useEffect(() => {
    if (user) {
      posthog.identify(user.id, {
        email: user.email,
        name: user.name,
        has_provider_page: Boolean(providerPage),
      });
    }
  }, [providerPage, user]);

  if (hiddenHeaderPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  if (focusedProviderRoutePatterns.some((pattern) => pattern.test(pathname))) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <nav className="relative mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <HomeLogo href={user ? "/discover" : "/"} />

        {isProviderWorkspace ? (
          <div className="absolute left-1/2 hidden -translate-x-1/2 md:block">
            <ProviderNavigation />
          </div>
        ) : user ? (
          <div className="hidden items-center gap-1 sm:flex">
            <HeaderLink href="/discover">Discover</HeaderLink>
            <HeaderLink href="/account/bookings">Bookings</HeaderLink>
            <HeaderLink href="/account" exact>
              Account
            </HeaderLink>
          </div>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <AccountMenu
              user={user}
              providerPage={providerPage}
            />
          ) : (
            <HeaderLink href="/sign-in">Log in</HeaderLink>
          )}
        </div>
      </nav>
      {isProviderWorkspace ? (
        <nav
          aria-label="Provider"
          className="overflow-x-auto border-t border-black/5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
        >
          <ProviderNavigation mobile />
        </nav>
      ) : null}
    </header>
  );
}
