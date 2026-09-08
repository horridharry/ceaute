"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { logoutUser } from "@/app/(authenticate)/actions";

const HomeLogo = () => (
  <Link href="/" className="text-xl font-semibold tracking-tighter">
    Ceaute
  </Link>
);

const hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/auth", "/provider"];

function HeaderLink({ href, children }) {
  return (
    <Link
      href={href}
      className="relative rounded-full px-3 py-1.5 text-sm font-medium text-black/70 transition hover:bg-black/[0.04] hover:text-black"
    >
      {children}
      <LinkPendingDot />
    </Link>
  );
}

function LinkPendingDot() {
  const { pending } = useLinkStatus();

  if (!pending) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-pink-500"
    />
  );
}

function AccountMenu({ user, hasProviderPage }) {
  const [open, setOpen] = useState(false);
  const providerHref = hasProviderPage ? "/provider" : "/provider/onboarding";

  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="flex max-w-44 items-center gap-2 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm font-medium text-black/75 shadow-sm transition hover:border-black/20 hover:bg-black/[0.03]"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="truncate">{user.name}</span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-2xl border border-black/10 bg-white py-2 shadow-lg shadow-black/10"
        >
          <div className="border-b border-black/10 px-4 pb-3 pt-1">
            <p className="truncate text-sm font-semibold text-black">
              {user.name}
            </p>
            <p className="truncate text-xs text-black/50">{user.email}</p>
          </div>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-black/70 hover:bg-black/[0.04] hover:text-black"
          >
            My account
          </Link>
          <Link
            href={providerHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-black/70 hover:bg-black/[0.04] hover:text-black"
          >
            {hasProviderPage ? "Provider workspace" : "Become a provider"}
          </Link>
          <form action={logoutUser} className="border-t border-black/10 pt-2">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

export default function NavbarClient({ user, hasProviderPage = false }) {
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
            <AccountMenu user={user} hasProviderPage={hasProviderPage} />
          ) : (
            <>
              <HeaderLink href="/sign-in">Sign in</HeaderLink>
              <Link
                href="/sign-up"
                className="rounded-full bg-pink-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-700"
              >
                Sign up
                <LinkPendingDot />
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
