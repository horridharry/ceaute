// The provider's drops, one card each: its name, whether it is open, how
// many dates it has with their times in one line, and its dates' (advisory,
// read on load) bookings added up. Each date's own bookings show in the
// editor. The drop being edited shows its editor in place of its card; while
// any editor is open no other drop can be edited. Presentational:
// AvailabilityForm owns the state.
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDropBookingsLine } from "../_lib/booking-messages";
import { dropStatusLine, dropSummaryLine } from "../_lib/drop-form";

export function DropList({
  drops,
  countsByDate,
  now,
  editingId = null,
  editor = null,
  onEdit,
}) {
  if (drops.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-col gap-3">
      {drops.map((drop) => {
        if (editingId === drop.id) {
          return (
            <li key={drop.id} className="flex flex-col gap-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{drop.name}</h2>
                <p className="text-sm text-ink-muted">{dropStatusLine(drop, now)}</p>
              </div>
              {editor}
            </li>
          );
        }

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
            {editingId === null ? (
              <Button
                id={`edit-${drop.id}`}
                type="button"
                variant="secondary"
                aria-label={`Edit ${drop.name}`}
                className="min-h-11 shrink-0"
                onClick={() => onEdit(drop.id)}
              >
                Edit
              </Button>
            ) : null}
          </Card>
        );
      })}
    </ul>
  );
}
