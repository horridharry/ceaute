// Notices are in-page and never a toast — 02-components.md "Notices".

// A provider's written policy, a piece of context the screen needs to state.
// Neutral surface, no icon, no accent.
export function InfoNotice({ className = "", children }) {
  return (
    <div
      className={`rounded-row bg-surface px-3.5 py-[13px] text-body text-black/80 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

// Something is wrong, or something is pending. A hairline rule top and bottom
// with a coloured dot — never a filled red or pink box.
export function ProblemNotice({
  title,
  tone = "bad",
  className = "",
  children,
}) {
  const dot = tone === "pending" ? "bg-pending" : "bg-bad";

  return (
    <div
      role={tone === "pending" ? "status" : "alert"}
      className={`flex gap-2.5 border-y border-black/8 py-[13px] ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`mt-[6px] block size-[7px] shrink-0 rounded-full ${dot}`}
      />
      <div className="flex flex-col gap-1">
        <p className="text-[13.5px] font-medium text-ink">{title}</p>
        {children ? (
          <p className="text-[12.5px]/[1.55] text-black/60">{children}</p>
        ) : null}
      </div>
    </div>
  );
}
