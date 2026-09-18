"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logoutUser } from "@/app/(authenticate)/actions";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PendingButton } from "@/components/pending-button";

const HomeLogo = () => (
  <Link href="/" className="text-xl font-semibold tracking-tighter">
    Ceaute
  </Link>
);

const hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/verify", "/auth"];

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
        isActive ? "text-black" : "text-black/70"
      }`}
    >
      {children}
      <LinkPendingHint />
    </Link>
  );
}

function AccountMenu({ user, hasProviderPage }) {
  const [open, setOpen] = useState(false);
  const dashboardHref = hasProviderPage ? "/dashboard" : "/dashboard/onboarding";
  const closeMenu = () => setOpen(false);

  return (
    <div className="">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="flex max-w-44 items-center gap-2 rounded-full border border-transparent bg-white text-sm font-medium text-black/75  transition hover:border-black/20 hover:bg-black/[0.03]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-surface text-xs font-semibold text-ink">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-14.5 z-50 h-screen w-full overflow-hidden    bg-white p-2"
        >
          <div className="mt-12" />
          <Link
            href="/discover"
            role="menuitem"
            onClick={closeMenu}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black"
          >
            Go to Ceaute
          </Link>
          <Link
            href="/account/bookings"
            role="menuitem"
            onClick={closeMenu}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black/80"
          >
            My bookings
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={closeMenu}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black/80"
          >
            My account
          </Link>

          <div className="mt-auto" />
          <Link
            href={dashboardHref}
            role="menuitem"
            onClick={closeMenu}
            className="block px-4 py-2 text-2xl font-semibold text-black/60 hover:text-black/80"
          >
            {hasProviderPage ? "Provider workspace" : "Become a provider"}
          </Link>
          <form action={logoutUser} className="mt-12">
            <PendingButton
              role="menuitem"
              pendingLabel="Signing out..."
              className="cursor-pointer rounded-full border border-black/40 w-full p-2.5 text-sm font-medium text-black  hover:opacity-80 duration-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sign out
            </PendingButton>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function AppHeaderClient({ user, hasProviderPage = false }) {
  const pathname = usePathname();

  if (hiddenHeaderPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/90 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <HomeLogo />
        <div className="flex items-center gap-1.5">
          {user ? (
            <>
              <div className="hidden items-center gap-1.5 sm:flex">
                <HeaderLink href="/discover">Discover</HeaderLink>
                <HeaderLink href="/account/bookings">Bookings</HeaderLink>
                <HeaderLink href="/account" exact>
                  Account
                </HeaderLink>
              </div>
              <AccountMenu user={user} hasProviderPage={hasProviderPage} />
            </>
          ) : (
            <>
              <HeaderLink href="/discover">Discover</HeaderLink>
              <HeaderLink href="/sign-in">Sign in</HeaderLink>
              <Link
                href="/sign-up"
                className="rounded-full bg-plum px-4 py-2 text-sm font-semibold text-white transition hover:bg-plum-hover"
              >
                Sign up
                <LinkPendingHint />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
