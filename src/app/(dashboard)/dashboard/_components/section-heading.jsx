import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

export function SectionHeading({ title, newHref, newLabel = "New" }) {
  return (
    <header className="min-w-0">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tighter">{title}</h1>
        {newHref ? (
          <Link
            href={newHref}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 py-2 text-sm font-semibold text-pink-600 hover:bg-pink-50"
          >
            + {newLabel}
            <LinkPendingHint />
          </Link>
        ) : null}
      </div>
    </header>
  );
}
