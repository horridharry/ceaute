"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logoutUser } from "@/app/(authenticate)/actions";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PendingButton } from "@/components/pending-button";
import { ProviderNavigation } from "./provider-navigation";

const hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/verify", "/auth"];

const focusedProviderRoutePatterns = [
  /^\/dashboard\/treatment-groups\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/add-ons\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/locations\/(?:new|[^/]+\/edit)$/,
];

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

function AccountMenu({ user, providerPage }) {
  const [open, setOpen] = useState(false);
  const hasProviderPage = Boolean(providerPage);
  const closeMenu = () => setOpen(false);
  const logout = async () => {
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
