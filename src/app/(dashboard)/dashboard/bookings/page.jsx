import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getAllBookings } from "./queries";
import { SectionTabs } from "@/features/navigation/section-tabs";
import { StatusBadge } from "../_components/status-badge";

const bookingTabs = [
  { key: "upcoming", label: "Upcoming" },
  { key: "previous", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
];

const BookingsLoadFailed = () => (
  <div className="mt-8 flex h-40 rounded-xl border border-black/10 p-4">
    <p className="m-auto text-center text-sm text-black/60">
      Could not load bookings. Refresh to try again.
    </p>
  </div>
);

function BookingItem({ booking }) {
  return (
    <Link
      href={`/dashboard/bookings/${booking.booking_id}`}
      className="block border-b border-black/10 py-4 last:border-b-0 hover:bg-black/[0.025]"
    >
      <article className="min-w-0 px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold">{booking.customer_name}</h3>
            <p className="mt-1 truncate text-sm text-black/70">
              {booking.treatment_name}
            </p>
          </div>
          <StatusBadge tone="quiet" className="shrink-0">
            {booking.status_label}
          </StatusBadge>
        </div>
        <p className="mt-2 text-sm font-medium">
          {booking.time_label} <span className="text-black/35">•</span>{" "}
          {booking.duration_label}
        </p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-black/55">
          <span>Total {booking.total_price_label}</span>
          <span>Paid online {booking.amount_paid_online_label}</span>
          <span>Due {booking.amount_due_at_appointment_label}</span>
        </div>
      </article>
    </Link>
  );
}

function bookingsByDay(bookings) {
  const grouped = new Map();

  for (const booking of bookings) {
    const date = booking.date_label || "Date unavailable";
    const entries = grouped.get(date) ?? [];
    entries.push(booking);
    grouped.set(date, entries);
  }

  return Array.from(grouped, ([date, entries]) => ({ date, entries }));
}

function BookingList({ bookings }) {
  if (bookings.length === 0) {
    return (
      <p className="mt-10 text-sm text-black/55">No bookings in this view.</p>
    );
  }

  return (
    <div className="mt-8">
      {bookingsByDay(bookings).map((group) => (
        <section key={group.date} className="mt-8 first:mt-0">
          <h2 className="text-sm font-semibold text-black/55">{group.date}</h2>
          <div className="mt-2">
            {group.entries.map((booking) => (
              <BookingItem key={booking.booking_id} booking={booking} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Loads bookings during the server render, like the customer bookings page.
// The route-level loading state covers navigation while this request completes.
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
  const requestedView = Array.isArray(params?.view)
    ? params.view[0]
    : params?.view;
  const activeTab =
    bookingTabs.find((tab) => tab.key === requestedView) ?? bookingTabs[0];
  const { bookingGroups, failed } = await loadBookingGroups();
  const bookings = failed ? [] : bookingGroups[activeTab.key];

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 min-w-0">
        <h1 className="text-3xl font-bold tracking-tighter">Bookings</h1>
        <SectionTabs
          ariaLabel="Booking status"
          showPendingHint={false}
          items={bookingTabs.map((tab) => ({
            label: tab.label,
            href:
              tab.key === "upcoming"
                ? "/dashboard/bookings"
                : `/dashboard/bookings?view=${tab.key}`,
            active: tab.key === activeTab.key,
          }))}
        />

        {failed ? (
          <BookingsLoadFailed />
        ) : (
          <BookingList bookings={bookings} />
        )}
      </div>
    </main>
  );
}
