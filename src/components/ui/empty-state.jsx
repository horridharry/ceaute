import { InlineLink } from "@/components/ui/button";

// A heading, one sentence, one link. No illustration and no card — an empty
// box advertises the absence.
export function EmptyState({ title, children, actionHref, actionLabel, className = "" }) {
  return (
    <div className={`flex flex-col items-start gap-2 py-6 ${className}`.trim()}>
      <h2 className="text-heading text-pretty text-ink">{title}</h2>
      <p className="text-body text-black/60">{children}</p>
      {actionHref ? (
        <InlineLink href={actionHref}>{actionLabel} →</InlineLink>
      ) : null}
    </div>
  );
}
