"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { logoutUser } from "@/features/auth/logout-action";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PendingButton } from "@/components/pending-button";
import { personalMenuLinks, signInHref } from "./personal-menu";
import { ProviderMenuSheet } from "./provider-menu-sheet";

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

const menuItemClassName =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm font-medium hover:bg-black/[0.04]";

function AccountMenu({ user, hasProviderPage, pathname }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const buttonRef = useRef(null);
  const closeMenu = () => setOpen(false);
  const logout = async () => {
    await logoutUser();
  };

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event) => {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Open account menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((currentOpen) => !currentOpen)}
        className="grid h-11 w-11 place-items-center rounded-full"
      >
        <span className="grid h-10 w-10 place-items-center rounded-full bg-pink-100 text-xs font-semibold text-pink-700 transition hover:bg-pink-200">
          {user.name.slice(0, 1).toUpperCase()}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-black/10 bg-white p-2 shadow-lg"
        >
          {personalMenuLinks({ hasProviderPage, pathname }).map((link) => (
            <div key={link.href} role="none" className={link.separatorBefore ? "mt-2 border-t border-black/10 pt-2" : ""}>
              <Link
                href={link.href}
                role="menuitem"
                aria-current={link.current ? "page" : undefined}
                onClick={closeMenu}
                className={`${menuItemClassName} ${link.current ? "bg-black/[0.04] font-semibold" : ""}`}
              >
                {link.label}
                <LinkPendingHint />
              </Link>
            </div>
          ))}

          <form action={logout} className="mt-2 border-t border-black/10 pt-2">
            <PendingButton
              role="menuitem"
              pendingLabel="Logging out..."
              className={`${menuItemClassName} disabled:cursor-not-allowed disabled:opacity-60`}
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
  const hasProviderPage = Boolean(user && providerPage);
  // /account is personal chrome, not the provider workspace.
  const isProviderWorkspace =
    hasProviderPage &&
    (pathname === "/dashboard" || pathname.startsWith("/dashboard/"));

  return (
    <header className="sticky top-0 z-40 border-b border-black/10 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <span className="flex items-center gap-2">
          <HomeLogo
            href={isProviderWorkspace ? "/dashboard" : "/discover"}
          />
          {isProviderWorkspace ? (
            // Approved 23 September 2026: a quiet label marks the provider
            // side; the header itself stays the same.
            <span className="rounded-full border border-line-strong px-2 py-0.5 text-xs font-medium text-ink-muted">
              Business
            </span>
          ) : null}
        </span>

        {user && !isProviderWorkspace ? (
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            <HeaderLink href="/account" exact>
              Account
            </HeaderLink>
            <HeaderLink href="/account/bookings">My bookings</HeaderLink>
            <HeaderLink href="/discover">Discover</HeaderLink>
          </nav>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
          {user ? (
            <AccountMenu
              user={user}
              hasProviderPage={hasProviderPage}
              pathname={pathname}
            />
          ) : (
            <HeaderLink href={signInHref(pathname)}>Log in</HeaderLink>
          )}
          {isProviderWorkspace ? (
            <ProviderMenuSheet providerPage={providerPage} />
          ) : null}
        </div>
      </div>
    </header>
  );
}
