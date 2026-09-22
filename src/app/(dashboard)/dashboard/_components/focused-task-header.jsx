import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

// The header of a create or edit screen, which replaces the app header:
// Cancel on the left and the task's title. The form's only submit is its
// FormActions row at the end of the form (the Booking settings pattern).
export function FocusedTaskHeader({ backHref, title }) {
  return (
    <header className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-line pb-4">
      <Link
        href={backHref}
        className="inline-flex min-h-11 w-max items-center rounded-lg text-sm font-medium text-ink-muted hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Cancel
        <LinkPendingHint />
      </Link>
      <h1 className="max-w-44 truncate text-center text-base font-semibold sm:max-w-none">
        {title}
      </h1>
      <span aria-hidden="true" />
    </header>
  );
}
