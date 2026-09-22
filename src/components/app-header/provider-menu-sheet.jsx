"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { useUnsavedChangesConfirming } from "@/components/unsaved-changes/use-unsaved-changes";
import {
  PROVIDER_MENU,
  PROVIDER_PREVIEW_HREF,
  activeMenuItemId,
  viewYourPageHref,
} from "./provider-menu";

function MenuIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// The provider menu: a left-side sheet on every screen size. The sheet is
// open only for the path it was opened on, so any navigation closes it.
export function ProviderMenuSheet({ providerPage }) {
  const pathname = usePathname();
  const isConfirming = useUnsavedChangesConfirming();
  const [openedAt, setOpenedAt] = useState(null);
  const dialogRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const closedForConfirmRef = useRef(false);

  // The unsaved-changes confirmation replaces the menu rather than opening
  // over it, so Keep editing returns to an unobscured page.
  if (isConfirming && openedAt !== null) {
    setOpenedAt(null);
  }

  const open = openedAt !== null && openedAt === pathname;
  const activeId = activeMenuItemId(pathname);
  const pageHref = viewYourPageHref(providerPage ?? {});
  const isLive = pageHref !== PROVIDER_PREVIEW_HREF;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
      const current =
        listRef.current?.querySelector('[aria-current="page"]') ??
        listRef.current?.querySelector("a[href]");
      current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    // Keep editing: back to the menu button once the confirmation the menu
    // gave way to has closed.
    if (isConfirming || !closedForConfirmRef.current) return;
    closedForConfirmRef.current = false;
    buttonRef.current?.focus();
  }, [isConfirming]);

  const close = () => setOpenedAt(null);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="Menu"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpenedAt(pathname)}
        className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-black/80 transition hover:bg-black/[0.04] hover:text-black"
      >
        <MenuIcon />
      </button>

      <dialog
        ref={dialogRef}
        aria-label="Menu"
        onClose={() => {
          // Escape, Close, a chosen destination and navigation all end here.
          setOpenedAt(null);
          if (isConfirming) {
            closedForConfirmRef.current = true;
          } else {
            buttonRef.current?.focus();
          }
        }}
        onKeyDown={(event) => {
          // Not every browser turns Escape into a cancel event, so close here
          // too; preventDefault stops the ones that do from repeating it.
          if (event.key === "Escape") {
            event.preventDefault();
            close();
          }
        }}
        onClick={(event) => {
          // The sheet fills the dialog box, so a click on the dialog itself
          // is a click on the backdrop.
          if (event.target === event.currentTarget) close();
        }}
        className="provider-menu-sheet fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-none w-[min(100%-48px,360px)] max-w-none bg-white p-0 text-black shadow-xl backdrop:bg-black/40"
      >
        <div className="flex h-full flex-col overflow-y-auto">
          <div className="flex h-14 shrink-0 items-center justify-end px-4">
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="-mr-2 grid h-11 w-11 place-items-center rounded-full text-black/80 transition hover:bg-black/[0.04] hover:text-black"
            >
              <CloseIcon />
            </button>
          </div>

          <nav aria-label="Your business" className="px-2">
            <ul ref={listRef}>
              {PROVIDER_MENU.map((item, index) =>
                item.separator ? (
                  <li
                    key={`separator-${index}`}
                    role="separator"
                    className="mx-3 my-2 h-px bg-black/10"
                  />
                ) : (
                  <li key={item.id}>
                    <MenuLink
                      href={item.href}
                      current={item.id === activeId}
                      onNavigate={close}
                    >
                      {item.label}
                    </MenuLink>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="mt-2 border-t border-black/10 px-2 pt-2 pb-6">
            <Link
              href={pageHref}
              onClick={close}
              className="flex min-h-11 flex-col justify-center rounded-lg px-3 py-2 text-[15px] font-medium hover:bg-black/[0.04]"
            >
              <span>
                View your page
                <LinkPendingHint />
              </span>
              {isLive ? null : (
                <span className="mt-0.5 text-sm font-normal text-black/55">
                  Not live yet. Opens a preview
                </span>
              )}
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}

function MenuLink({ href, current, onNavigate, children }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      onClick={onNavigate}
      className={`relative flex min-h-11 items-center rounded-lg px-3 text-[15px] hover:bg-black/[0.04] ${
        current ? "bg-black/[0.05] font-semibold" : "font-medium text-black/80"
      }`}
    >
      {current ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-2.5 left-0 w-[3px] rounded-full bg-black"
        />
      ) : null}
      {children}
      <LinkPendingHint />
    </Link>
  );
}
