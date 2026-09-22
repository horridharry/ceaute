// Secondary content that stays available but out of the way until asked for:
// archived treatments, a booking's cancellation policy, payment fees.
import { composeClassName } from "./class-names";

export function Disclosure({ summary, defaultOpen = false, className = "", children }) {
  return (
    <details
      open={defaultOpen || undefined}
      className={composeClassName("group border-y border-line", className)}
    >
      <summary className="flex min-h-13 cursor-pointer list-none items-center justify-between gap-3 rounded-lg text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
        {summary}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-4 w-4 shrink-0 text-ink-muted group-open:rotate-180 motion-safe:transition-transform"
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="flex flex-col gap-3 pb-4 text-sm">{children}</div>
    </details>
  );
}
