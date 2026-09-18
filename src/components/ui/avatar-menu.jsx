"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// A popover from the top right, not a full-screen drawer. `Your page` carries
// a plum "Provider" label when she has one, which is the only place the two
// sides of the product are named next to each other.
export function AvatarMenu({
  initial,
  providerHref,
  hasProviderPage = false,
  logoutAction,
  className = "",
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function handleKeyDown(event) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const itemClassName =
    "flex items-center justify-between gap-2 rounded-[10px] px-3 py-[11px] text-[14px] font-medium text-ink transition duration-150 ease-out hover:bg-surface";

  return (
    <div ref={containerRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account"
        onClick={() => setOpen((current) => !current)}
        className="grid size-9 place-items-center rounded-full bg-surface text-[13px] font-semibold text-ink"
      >
        {initial}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-[210px] rounded-card bg-white p-1.5 shadow-popover"
        >
          <Link
            href="/account/bookings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClassName}
          >
            Bookings
          </Link>
          <Link
            href="/account"
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClassName}
          >
            Account
          </Link>

          <div className="my-1.5 border-t border-black/8" />

          <Link
            href={providerHref}
            role="menuitem"
            onClick={() => setOpen(false)}
            className={itemClassName}
          >
            Your page
            {hasProviderPage ? (
              <span className="text-[11.5px] font-medium tracking-[0.06em] text-plum">
                PROVIDER
              </span>
            ) : null}
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className={`${itemClassName} w-full text-left text-black/60`}
            >
              Log out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
