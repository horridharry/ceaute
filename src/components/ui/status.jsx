// Status is a 7px dot plus a word in the dot's colour — 02-components.md
// "Status". No pills, no tinted backgrounds; the earlier pill treatment was
// cut for looking generic.
//
// The tone map is keyed by the values the database actually stores, so a
// screen can pass `booking.status` or `paymentAttempt.payment_status`
// straight through rather than translating at every call site.
const TONES = {
  confirmed: { dot: "bg-plum", label: "text-plum" },
  ok: { dot: "bg-ok", label: "text-ok" },
  pending: { dot: "bg-pending", label: "text-pending" },
  bad: { dot: "bg-bad", label: "text-bad" },
  // Nothing is happening and nothing is wrong: a neutral dot with a label
  // quieter than the dot itself.
  muted: { dot: "bg-black/30", label: "text-black/60" },
};

const STATUS_TONES = {
  confirmed: "confirmed",
  active: "ok",
  completed: "ok",
  published: "ok",
  refunded: "ok",
  payments_ready: "ok",
  awaiting_payment: "muted",
  cancelled: "muted",
  expired: "muted",
  archived: "muted",
  draft: "muted",
  refund_required: "pending",
  refund_processing: "pending",
  stripe_incomplete: "pending",
  refund_failed: "bad",
  restricted: "bad",
};

export function statusTone(status) {
  return STATUS_TONES[status] ?? "muted";
}

export function StatusDot({ status, tone, label, className = "" }) {
  const resolved = TONES[tone ?? statusTone(status)] ?? TONES.muted;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${resolved.label} ${className}`.trim()}
    >
      <span
        aria-hidden="true"
        className={`block size-[7px] shrink-0 rounded-full ${resolved.dot}`}
      />
      {label}
    </span>
  );
}
