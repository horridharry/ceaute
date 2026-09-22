import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  formatClockTime,
  formatShortDate,
  formatTimeRange,
  inspirationLine,
  treatmentLine,
} from "../_lib/booking-format";

function PhotoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-3.5 w-3.5">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="m21 16-5-5-9 9" strokeLinejoin="round" />
    </svg>
  );
}

// One appointment in a list: the whole row opens the booking. `variant`
// decides the time column: "today" (start time), "upcoming" (start time and
// date) or "list" (the time range, with money to collect or who cancelled on
// the right).
export function BookingRow({ booking, variant = "list" }) {
  const photos = inspirationLine(booking.inspiration_image_count);
  const cancelledBy =
    booking.status === "cancelled"
      ? booking.cancelled_by === "provider"
        ? "By you"
        : "By customer"
      : "";
  const toCollect =
    variant === "list" && !cancelledBy && booking.status === "confirmed" && booking.amount_due_at_appointment_pence > 0
      ? booking.amount_due_at_appointment_label
      : "";

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/dashboard/bookings/${booking.booking_id}`}
        className={`grid items-start gap-3 rounded-lg py-3.5 hover:bg-ink/[0.02] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
          variant === "list" ? "grid-cols-[1fr_auto]" : "grid-cols-[4.5rem_1fr]"
        }`}
      >
        {variant === "list" ? null : (
          <span className="flex flex-col">
            <span className="font-semibold tabular-nums">{formatClockTime(booking.start_at)}</span>
            {variant === "upcoming" ? (
              <span className="text-[13px] text-ink-muted">{formatShortDate(booking.start_at)}</span>
            ) : null}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          {variant === "list" ? (
            <span className="text-sm font-semibold tabular-nums">
              {formatTimeRange(booking.start_at, booking.end_at)}
            </span>
          ) : null}
          <span className="font-semibold [overflow-wrap:anywhere]">{booking.customer_name}</span>
          <span className="text-[13px] text-ink-muted">{treatmentLine(booking)}</span>
          {photos ? (
            <span className="flex items-center gap-1 text-xs text-ink-muted">
              <PhotoIcon />
              {photos}
            </span>
          ) : null}
        </span>
        {variant === "list" ? (
          <span className="text-right text-[13px] text-ink-muted">
            {cancelledBy ? <Badge tone="quiet">{cancelledBy}</Badge> : null}
            {toCollect ? (
              <>
                To collect
                <span className="block font-semibold tabular-nums text-ink">{toCollect}</span>
              </>
            ) : null}
          </span>
        ) : null}
      </Link>
    </li>
  );
}
