"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// One modal pattern in the product, not two: centred, scrimmed, radius 18,
// with the only large shadow the system allows. The treatment detail and the
// area picker both use it. Bottom sheets were removed deliberately.
//
// Focus is managed rather than left to the page: opening moves focus to the
// dialog, Tab and Shift+Tab cycle within it, Escape closes it, and closing
// returns focus to whatever opened it. The effect depends only on `open`, with
// `onClose` held in a ref, so a parent passing an inline arrow does not tear
// the trap down and re-take focus on every render.
export function Modal({
  open = true,
  onClose,
  title,
  labelledBy = "modal-title",
  className = "",
  children,
  footer,
}) {
  const dialogRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return undefined;

    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;

    function focusable() {
      return [...dialog.querySelectorAll(FOCUSABLE)];
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab") return;

      const items = focusable();

      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active);

      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.focus();

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-5"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy : undefined}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-modal bg-white shadow-modal outline-none ${className}`.trim()}
      >
        {title ? (
          <div className="flex items-start justify-between gap-3 px-5 pt-5">
            <h2 id={labelledBy} className="text-title text-pretty text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-full text-[15px] text-black/50 transition duration-150 ease-out hover:text-ink"
            >
              ✕
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer ? (
          <div className="border-t border-black/8 px-5 pb-5 pt-3">{footer}</div>
        ) : null}
      </div>
    </div>
  );
}
