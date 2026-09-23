import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { cancellationRefund, upcomingMoney } from "@/lib/bookings/booking-card-money";
import { formatMoneyFromPence, providerBookingView } from "@/lib/bookings/booking-display";
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

// One appointment as a card (approved 23 September 2026): the whole card
// opens the booking. `variant` decides the lead: "today" (start time),
// "upcoming" (start time and date) or "list" (the time range, with the one
// money fact on the right). Today's cards carry no money.
function MoneyFact({ booking }) {
  const view = providerBookingView(booking);

  if (view === "cancelled") {
    const refund = cancellationRefund(booking);
    const refundText = !refund
      ? ""
      : refund.kind === "refunded"
        ? `Refunded ${formatMoneyFromPence(refund.pence)}`
        : refund.kind === "pending"
          ? "Refund pending"
          : refund.kind === "failed"
            ? "Refund failed"
            : "No refund";

    return (
      <span className="flex flex-col items-end gap-1 text-right text-[13px] text-ink-muted">
        <Badge tone="quiet">{booking.cancelled_by === "provider" ? "By you" : "By customer"}</Badge>
        {refundText ? <span className={refund.kind === "failed" ? "text-danger" : ""}>{refundText}</span> : null}
      </span>
    );
  }

  if (view !== "upcoming") {
    return null;
  }

  const money = upcomingMoney(booking);

  if (money?.kind === "collect") {
    return (
      <span className="text-right text-[13px] text-ink-muted">
        To collect
        <span className="block font-semibold tabular-nums text-ink">{formatMoneyFromPence(money.pence)}</span>
      </span>
    );
  }

  return money?.kind === "paid_in_full" ? (
    <span className="text-right text-[13px] text-ink-muted">Paid in full</span>
  ) : null;
}

export function BookingCard({ booking, variant = "list" }) {
  const photos = inspirationLine(booking.inspiration_image_count);
  const isList = variant === "list";

  return (
    <li>
      <Link
        href={`/dashboard/bookings/${booking.booking_id}`}
        className={`grid items-start gap-3 rounded-xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus motion-reduce:transition-none ${
          isList ? "grid-cols-[1fr_auto]" : "grid-cols-[5.5rem_1fr]"
        } ${booking.status === "cancelled" ? "text-ink-muted" : ""}`}
      >
        {isList ? null : (
          <span className="flex flex-col">
            <span className="whitespace-nowrap font-semibold tabular-nums">{formatClockTime(booking.start_at)}</span>
            {variant === "upcoming" ? (
              <span className="whitespace-nowrap text-[13px] text-ink-muted">{formatShortDate(booking.start_at)}</span>
            ) : null}
          </span>
        )}
        <span className="flex min-w-0 flex-col gap-0.5">
          {isList ? (
            <span className="text-sm font-semibold tabular-nums">
              {formatTimeRange(booking.start_at, booking.end_at)}
            </span>
          ) : null}
          <span className="font-semibold [overflow-wrap:anywhere]">{booking.customer_name}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-ink-muted">
            <span>{treatmentLine(booking)}</span>
            {photos ? (
              <span className="flex items-center gap-1">
                <PhotoIcon />
                {photos}
              </span>
            ) : null}
          </span>
        </span>
        {isList ? <MoneyFact booking={booking} /> : null}
      </Link>
    </li>
  );
}
