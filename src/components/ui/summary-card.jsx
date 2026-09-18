// What is being agreed to, line by line. The last line is the total: it loses
// the rule beneath it and steps up a size, so the eye lands there.
export function SummaryCard({ className = "", children }) {
  return (
    <div
      className={`rounded-card border border-black/12 bg-white px-3.5 py-0.5 ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function SummaryLine({ label, value, total = false, className = "" }) {
  return (
    <div
      className={`flex items-baseline justify-between gap-3 py-2.5 ${
        total ? "" : "border-b border-black/8"
      } ${className}`.trim()}
    >
      <span
        className={
          total ? "text-[15px] font-medium text-ink" : "text-[13.5px] text-black/60"
        }
      >
        {label}
      </span>
      <span
        className={`tabular-nums ${
          total ? "text-[15px] font-medium text-ink" : "text-[13.5px] text-ink"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
