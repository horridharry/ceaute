import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

export function FocusedTaskHeader({ backHref, backLabel, title }) {
  return (
    <header className="pt-1">
      <Link
        href={backHref}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-accent-600"
      >
        <span aria-hidden="true" className="text-[15px] leading-none">‹</span>
        {backLabel}
        <LinkPendingHint />
      </Link>
      <h1 className="mt-1.5 text-2xl font-bold tracking-tighter">{title}</h1>
    </header>
  );
}
