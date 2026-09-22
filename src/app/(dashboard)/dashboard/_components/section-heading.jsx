import Link from "next/link";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { PageHeading } from "@/components/ui/page-heading";

// A dashboard screen's title with its optional description and "New" link
// (the only way to create from a list), or another action. The shared
// PageHeading, 24px from the top of the container.
export function SectionHeading({
  title,
  description = "",
  newHref = "",
  newLabel = "New",
  back = null,
  action = null,
  size = "lg",
}) {
  const newLink = newHref ? (
    <Link
      href={newHref}
      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full px-3 py-2 text-sm font-semibold text-accent hover:bg-pink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <span aria-hidden="true">+</span>
      {newLabel}
      <LinkPendingHint />
    </Link>
  ) : null;

  return (
    <PageHeading
      className="pt-6"
      title={title}
      description={description}
      back={back}
      size={size}
      action={action ?? newLink}
    />
  );
}
