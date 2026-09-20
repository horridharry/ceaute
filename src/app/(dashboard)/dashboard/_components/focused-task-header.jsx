import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";

export function FocusedTaskHeader({
  backHref,
  title,
  formId,
  submitLabel,
  pendingLabel = "Saving...",
  pending = false,
  disabled = false,
}) {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-black/10 pb-4">
      <Link
        href={backHref}
        className="w-max text-sm font-medium text-black/60 hover:text-black"
      >
        Cancel
        <LinkPendingHint />
      </Link>
      <h1 className="max-w-44 truncate text-center text-base font-semibold sm:max-w-none">
        {title}
      </h1>
      <button
        type="submit"
        form={formId}
        disabled={pending || disabled}
        aria-disabled={pending || disabled}
        className="ml-auto w-max text-sm font-semibold text-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? pendingLabel : submitLabel}
      </button>
    </header>
  );
}
