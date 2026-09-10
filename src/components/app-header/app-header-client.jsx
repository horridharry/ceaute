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

const hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/auth"];

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
      className="absolute right-1 top-1 h-1.5 w-2 rounded-full bg-pink-500"
    />
  );
}

function AccountMenu({ user, hasProviderPage }) {
  const [open, setOpen] = useState(false);
  const providerHref = hasProviderPage ? "/provider" : "/provider/onboarding";

  return (
    <div className="">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="flex max-w-44 items-center gap-2 rounded-full border border-transparent bg-white text-sm font-medium text-black/75  transition hover:border-black/20 hover:bg-black/[0.03]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700">
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
            href="/"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black"
          >
            Home
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black/80"
          >
            Profile
          </Link>
          <Link
            href="/account/bookings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-xl font-medium text-black/60 hover:text-black/80"
          >
            Bookings
          </Link>

          <div className="mt-auto" />
          <Link
            href={providerHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-2xl font-semibold text-black/60 hover:text-black/80"
          >
            {hasProviderPage ? "Provider workspace" : "Become a provider"}
          </Link>
          <form action={logoutUser} className="mt-12">
            <button
              type="submit"
              role="menuitem"
              className="cursor-pointer rounded-full border border-black/40 w-full p-2.5 text-sm font-medium text-black  hover:opacity-80 duration-200"
            >
              Sign out
            </button>
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
