const tones = {
  active: "bg-pink-50 text-pink-700",
  neutral: "bg-black/5 text-black/50",
  quiet: "bg-black/5 text-black/55",
};

export function StatusBadge({ children, tone = "neutral", className = "" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
