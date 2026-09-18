import { ListGroup, ListTemplate } from "@/components/templates/list-template";
import { BookingCard } from "@/components/ui/booking-card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLink } from "@/components/ui/button";

// A2. The first dashboard tab is Today, not Overview: she opens her phone to
// see today's work, not a grid of links to settings.
//
// No new query. It reads the same get_provider_booking_summaries the bookings
// route already uses and splits the upcoming group by date, so nothing extra
// is loaded and nothing about booking data changed.
//
// `Mark done` and the photo prompt are deliberately absent. The
// complete-bookings cron already reaches the same end state, so nothing is
// broken without them.
function splitDateLabel(dateLabel) {
  const [weekday, rest] = String(dateLabel ?? "").split(",");

  return {
    weekdayLabel: (weekday ?? "").trim().slice(0, 3),
    dayLabel: (rest ?? "").trim().split(" ")[0] ?? "",
  };
}

// booking-display.js returns "Unavailable" when a booking has no payment
// attempt yet, so the amount is left off rather than reading "Unavailable to
// collect".
function providerAmountLabel(booking) {
  const amount = booking.amount_due_at_appointment_label;

  if (!amount || amount === "Unavailable") return undefined;
  if (amount === "£0.00") return "Paid in full";

  return `${amount} to collect`;
}

function ProviderBookings({ bookings }) {
  return bookings.map((booking) => {
    const { weekdayLabel, dayLabel } = splitDateLabel(booking.date_label);

    return (
      <BookingCard
        key={booking.booking_id}
        href={`/dashboard/bookings/${booking.booking_id}`}
        weekdayLabel={weekdayLabel}
        dayLabel={dayLabel}
        title={`${booking.customer_name} · ${booking.treatment_name}`}
        amountLabel={providerAmountLabel(booking)}
        meta={booking.time_label}
        status={booking.status}
        statusLabel={booking.status_label}
      />
    );
  });
}

export function DashboardToday({ todayLabel, today, nextUp, username }) {
  const hasAnything = today.length > 0 || nextUp.length > 0;

  return (
    <ListTemplate title="Today" meta={todayLabel}>
      {today.length ? (
        <ListGroup>
          <ProviderBookings bookings={today} />
        </ListGroup>
      ) : (
        <EmptyState title="Nothing booked today">
          {hasAnything
            ? "Nothing in the diary for today. What's next is below."
            : "Your page is live. Share it and the diary fills up."}
          {username ? (
            <>
              {" "}
              <InlineLink href={`/@${username}`}>ceaute.com/@{username}</InlineLink>
            </>
          ) : null}
        </EmptyState>
      )}

      {nextUp.length ? (
        <ListGroup label="Next up">
          <ProviderBookings bookings={nextUp} />
        </ListGroup>
      ) : null}
    </ListTemplate>
  );
}
