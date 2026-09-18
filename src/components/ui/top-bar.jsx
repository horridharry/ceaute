import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// Three top bars and no others — 02-components.md "Navigation". All 52px.
//
// The avatar is the only top-right control a customer ever sees, and it is
// never the way out of a task: exits live in the bottom third, within thumb
// reach.
const BAR = "flex h-[52px] items-center gap-3 bg-white";

export function RootTopBar({ className = "", children }) {
  return (
    <header className={`${BAR} justify-between ${className}`.trim()}>
      <Link
        href="/"
        className="text-[16px] font-semibold tracking-[-0.03em] text-ink"
      >
        Ceaute
      </Link>
      {children}
    </header>
  );
}

// The back control is a plum chevron and the parent's name, given the same
// treatment as every other link so it reads as tappable. An earlier version
// used a 32px outlined circle; it was cut for looking like a new component.
export function StackedTopBar({
  backHref,
  backLabel,
  stepLabel,
  className = "",
}) {
  return (
    <header className={`${BAR} justify-between ${className}`.trim()}>
      <Link
        href={backHref}
        className="flex items-center gap-1 text-[14px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
      >
        <span aria-hidden="true" className="text-[17px] leading-none">
          ‹
        </span>
        {backLabel}
        <LinkPendingHint />
      </Link>
      {stepLabel ? (
        <span className="text-[12px] font-medium text-black/45">{stepLabel}</span>
      ) : null}
    </header>
  );
}

// Save duplicates the commit bar's primary and stays disabled until the form
// is valid, so a long form can be committed from either end.
export function ModalTopBar({
  title,
  onCancel,
  cancelLabel = "Cancel",
  className = "",
  children,
}) {
  return (
    <header className={`${BAR} justify-between px-1 ${className}`.trim()}>
      <button
        type="button"
        onClick={onCancel}
        className="min-w-16 text-left text-[14px] font-medium text-black/60 transition duration-150 ease-out hover:text-ink"
      >
        {cancelLabel}
      </button>
      <span className="truncate text-[14px] font-semibold text-ink">{title}</span>
      <span className="flex min-w-16 justify-end">{children}</span>
    </header>
  );
}
