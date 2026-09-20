const tones = {
  active:  "bg-accent-600",
  good:    "bg-good",
  warn:    "bg-warn",
  bad:     "bg-bad",
  neutral: "bg-black/30",
};

const text = {
  active:  "text-accent-600",
  good:    "text-good",
  warn:    "text-warn",
  bad:     "text-bad",
  neutral: "text-black/55",
};

export function StatusBadge({ children, tone = "neutral", className = "" }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${text[tone]} ${className}`}>
      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${tones[tone]}`} />
      {children}
    </span>
  );
}
