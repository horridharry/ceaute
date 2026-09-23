import { unstable_rethrow } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { HistoryFilterViews } from "@/components/history-filter-views";
import { providerBookingViewFromParam } from "@/lib/bookings/booking-display";
import { DashboardPage } from "../_components/dashboard-page";
import { BookingCard } from "../_components/booking-card";
import { formatShortDate } from "../_lib/booking-format";
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
    const date = formatShortDate(booking.start_at) || "Date unavailable";
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

function BookingList({ bookings, empty }) {
  if (bookings.length === 0) {
    return <EmptyState className="mt-6">{empty}</EmptyState>;
  }

  return (
    <div className="mt-2">
      {bookingsByDay(bookings).map((day) => (
        <section key={day.date} aria-label={day.date} className="mt-5">
          <h2 className="text-[13px] font-semibold text-ink-muted">{day.date}</h2>
          <ul className="mt-2 flex flex-col gap-2">
            {day.entries.map((booking) => (
              <BookingCard key={booking.booking_id} booking={booking} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// Every view is rendered once and switched on the device (approved
// 23 September 2026): the counts need all three groups anyway, so a filter
// tap costs no server round trip. The URL still carries ?view= for sharing,
// reloads and Back.
export default async function DashboardBookingsPage({ searchParams }) {
  const params = await searchParams;
  const requested = Array.isArray(params?.view) ? params.view[0] : params?.view;
  const view = VIEWS.find((candidate) => candidate.key === providerBookingViewFromParam(requested));
  const { bookingGroups, failed } = await loadBookingGroups();

  return (
    <DashboardPage title="Bookings">
      {failed ? (
        <p role="alert" className="mt-6 text-sm text-danger">
          Could not load bookings. Refresh to try again.
        </p>
      ) : (
        <HistoryFilterViews
          label="Filter bookings"
          className="mt-6"
          defaultKey="upcoming"
          serverKey={view.key}
          options={VIEWS.map((candidate) => ({
            key: candidate.key,
            label: candidate.label,
            href: candidate.key === "upcoming" ? "/dashboard/bookings" : `/dashboard/bookings?view=${candidate.key}`,
            count: bookingGroups[candidate.key].length,
          }))}
          panels={Object.fromEntries(
            VIEWS.map((candidate) => [
              candidate.key,
              <BookingList key={candidate.key} bookings={bookingGroups[candidate.key]} empty={candidate.empty} />,
            ]),
          )}
        />
      )}
    </DashboardPage>
  );
}
