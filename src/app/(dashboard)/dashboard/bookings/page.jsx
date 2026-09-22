import { unstable_rethrow } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkFilterPills } from "@/components/ui/filter-pills";
import { providerBookingViewFromParam } from "@/lib/bookings/booking-display";
import { DashboardPage } from "../_components/dashboard-page";
import { BookingRow } from "../_components/booking-row";
import { getAllBookings } from "./queries";

// Filters by what the booking is, not only when it is: Upcoming (confirmed),
// Completed (completed, or confirmed and over) and Cancelled (cancelled by a
// customer or by the provider). Unpaid and expired holds are in none of them
// and in no count; loadProviderBookingGroups leaves them out on the server.
const VIEWS = [
  { key: "upcoming", label: "Upcoming", empty: "No upcoming bookings." },
  { key: "completed", label: "Completed", empty: "No completed bookings." },
  { key: "cancelled", label: "Cancelled", empty: "No cancelled bookings." },
];

function bookingsByDay(bookings) {
  const days = [];
  for (const booking of bookings) {
    const date = booking.date_label || "Date unavailable";
    const day = days.at(-1);
    if (day?.date === date) day.entries.push(booking);
    else days.push({ date, entries: [booking] });
  }
  return days;
}

async function loadBookingGroups() {
  try {
    return { bookingGroups: await getAllBookings(), failed: false };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { bookingGroups: null, failed: true };
  }
}

export default async function DashboardBookingsPage({ searchParams }) {
  const params = await searchParams;
  const requested = Array.isArray(params?.view) ? params.view[0] : params?.view;
  const view = VIEWS.find((candidate) => candidate.key === providerBookingViewFromParam(requested));
  const { bookingGroups, failed } = await loadBookingGroups();
  const bookings = failed ? [] : bookingGroups[view.key];

  return (
    <DashboardPage title="Bookings">
      <LinkFilterPills
        label="Filter bookings"
        value={view.key}
        className="mt-6"
        options={VIEWS.map((candidate) => ({
          key: candidate.key,
          label: candidate.label,
          href: candidate.key === "upcoming" ? "/dashboard/bookings" : `/dashboard/bookings?view=${candidate.key}`,
          count: failed ? undefined : bookingGroups[candidate.key].length,
        }))}
      />

      {failed ? (
        <p role="alert" className="mt-6 text-sm text-danger">
          Could not load bookings. Refresh to try again.
        </p>
      ) : bookings.length === 0 ? (
        <EmptyState className="mt-6">{view.empty}</EmptyState>
      ) : (
        <div className="mt-2">
          {bookingsByDay(bookings).map((day) => (
            <section key={day.date} aria-label={day.date} className="mt-5">
              <h2 className="text-[13px] font-semibold text-ink-muted">{day.date}</h2>
              <ul className="mt-1">
                {day.entries.map((booking) => (
                  <BookingRow key={booking.booking_id} booking={booking} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </DashboardPage>
  );
}
