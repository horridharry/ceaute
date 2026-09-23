"use client";

// A row's secondary actions behind one "more" button. It is a disclosure of
// real buttons and links, not an ARIA menu, so Tab order and screen readers
// behave as they do everywhere else. Opening moves focus to the first
// available action; Escape, choosing an action or clicking outside closes it,
// and Escape returns focus to the trigger. A disabled action stays visible
// with the reason it is unavailable, linked by aria-describedby.
//
// items: [{ key, label, onSelect?, href?, tone?: "danger", disabled?,
//           reason?, separatorBefore? }]
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

const TRIGGER =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

const ITEM =
  "flex min-h-11 w-full items-center rounded-lg px-3 text-left text-sm hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-focus disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent";

export function ActionMenu({ label, items, align = "right" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  const close = useCallback((returnFocus) => {
    setOpen(false);
    if (returnFocus) {
      triggerRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;

    panelRef.current?.querySelector("a[href], button:not([disabled])")?.focus();

    const onPointerDown = (event) => {
      if (
        !panelRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target)
      ) {
        close(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(true);
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Tabbing out of the panel closes it, like any other disclosure.
  const onBlur = (event) => {
    const next = event.relatedTarget;
    if (next && !panelRef.current?.contains(next) && next !== triggerRef.current) {
      close(false);
    }
  };

  const select = (item) => {
    // Focus goes back to the trigger first, so a dialog opened by the action
    // returns focus there when it closes.
    close(true);
    item.onSelect?.();
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close(true) : setOpen(true))}
        className={TRIGGER}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </svg>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          role="group"
          aria-label={label}
          onBlur={onBlur}
          className={`absolute top-full z-20 mt-1 flex w-56 max-w-[calc(100vw-2.5rem)] flex-col rounded-xl border border-line bg-surface p-1.5 shadow-lg ${
            align === "left" ? "left-0" : "right-0"
          }`}
        >
          {items.map((item) => {
            const reasonId = `${panelId}-${item.key}-reason`;
            const tone = item.tone === "danger" ? "text-destructive" : "text-ink";

            return (
              <div key={item.key}>
                {item.separatorBefore ? <hr className="my-1 border-line" /> : null}
                {item.href && !item.disabled ? (
                  <Link href={item.href} className={`${ITEM} ${tone}`} onClick={() => close(false)}>
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    disabled={item.disabled}
                    aria-describedby={item.disabled && item.reason ? reasonId : undefined}
                    onClick={() => select(item)}
                    className={`${ITEM} ${item.disabled ? "" : tone}`}
                  >
                    {item.label}
                  </button>
                )}
                {item.disabled && item.reason ? (
                  <p id={reasonId} className="px-3 pb-2 text-xs text-ink-muted">
                    {item.reason}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
