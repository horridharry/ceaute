// The provider's drops, one card each: its name, whether it is open, how
// many dates it has with their times in one line, and its dates' (advisory,
// read on load) bookings added up. Each date's own bookings show in the
// editor, which opens on its own page from the card's Edit link.
import Link from "next/link";
import { buttonClassName } from "@/components/ui/button-classes";
import { Card } from "@/components/ui/card";
import { formatDropBookingsLine } from "../_lib/booking-messages";
import { dropStatusLine, dropSummaryLine } from "../_lib/drop-form";

export function DropList({ drops, countsByDate, now }) {
  if (drops.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-3">
      {drops.map((drop) => {
        const bookingsLine = formatDropBookingsLine(drop.dates, countsByDate);

        return (
          <Card as="li" key={drop.id} className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{drop.name}</h2>
              <p className="text-sm text-ink-muted">{dropStatusLine(drop, now)}</p>
              <p className="text-sm tabular-nums">{dropSummaryLine(drop)}</p>
              {bookingsLine ? (
                <p className="text-sm text-ink-muted">{bookingsLine}</p>
              ) : null}
            </div>
            <Link
              href={`/dashboard/availability/${drop.id}/edit`}
              aria-label={`Edit ${drop.name}`}
              className={buttonClassName({
                variant: "secondary",
                className: "shrink-0",
              })}
            >
              Edit
            </Link>
          </Card>
        );
      })}
    </ul>
  );
}
