import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PageHeading } from "@/components/ui/page-heading";

// A dashboard section's title with its optional "+ New" link: the shared
// PageHeading at its large size, kept under this name so existing sections
// need no edits.
export function SectionHeading({ title, newHref, newLabel = "New" }) {
  return (
    <PageHeading
      title={title}
      action={
        newHref ? (
          <Link
            href={newHref}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-sm font-semibold text-accent hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            + {newLabel}
            <LinkPendingHint />
          </Link>
        ) : null
      }
    />
  );
}
