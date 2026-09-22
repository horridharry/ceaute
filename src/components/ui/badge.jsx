// A small status label. Neutral by default; a dot adds meaning without
// colouring the whole object: pink (attention) for something the provider
// acts on, green (live) only for live or connected. quiet is for secondary
// facts such as "Archived" or "By customer". Never use a badge to repeat
// the state a filtered list already shows.
import { composeClassName } from "./class-names";

const TONES = {
  neutral: { box: "border-line bg-surface text-ink-muted", dot: "" },
  attention: { box: "border-line bg-surface text-ink-muted", dot: "bg-action" },
  live: { box: "border-line bg-surface text-ink-muted", dot: "bg-green-700" },
  quiet: { box: "border-transparent bg-surface-subtle text-ink-muted", dot: "" },
};

export function Badge({ tone = "neutral", className = "", children }) {
  const { box, dot } = TONES[tone] ?? TONES.neutral;

  return (
    <span
      className={composeClassName(
        `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${box}`,
        className,
      )}
    >
      {dot ? <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${dot}`} /> : null}
      {children}
    </span>
  );
}
