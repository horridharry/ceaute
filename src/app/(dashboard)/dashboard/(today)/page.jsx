import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import { getTodayBookingGroups } from "./queries";

const londonDay = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Europe/London",
});

const londonDateLabel = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});

const londonTimeLabel = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
});

function isToday(value, now) {
  const date = new Date(value);
  return (
    !Number.isNaN(date.getTime()) &&
    londonDay.format(date) === londonDay.format(now)
  );
}

async function loadTodaysBookings(now) {
  try {
    const groups = await getTodayBookingGroups();

    return {
      failed: false,
      bookings: [...groups.upcoming, ...groups.previous]
        .filter(
          (booking) =>
            ["confirmed", "completed"].includes(booking.status) &&
            isToday(booking.start_at, now),
        )
        .sort((first, second) =>
          String(first.start_at).localeCompare(String(second.start_at)),
        ),
    };
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { failed: true, bookings: [] };
  }
}

export default async function DashboardTodayPage() {
  const now = new Date();
  const { bookings, failed } = await loadTodaysBookings(now);

  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-6">
        <h1 className="text-3xl font-bold tracking-tighter">Today</h1>
        <p className="mt-2 text-sm font-medium text-black/55">
          {londonDateLabel.format(now)}
        </p>

        {failed ? (
          <p className="mt-10 rounded-xl border border-red-200 p-4 text-sm text-red-700">
            Could not load today&apos;s bookings. Refresh to try again.
          </p>
        ) : bookings.length ? (
          <ul className="mt-8 divide-y divide-black/10 border-y border-black/10">
            {bookings.map((booking) => (
              <li key={booking.booking_id}>
                <Link
                  href={`/dashboard/bookings/${booking.booking_id}`}
                  className="grid grid-cols-[4.5rem_1fr] gap-4 py-4 hover:bg-black/[0.02]"
                >
                  <time
                    dateTime={booking.start_at}
                    className="text-sm font-semibold tabular-nums"
                  >
                    {londonTimeLabel.format(new Date(booking.start_at))}
                  </time>
                  <span>
                    <span className="block text-sm font-medium">
                      {booking.treatment_name}
                    </span>
                    <span className="mt-0.5 block text-sm text-black/55">
                      {booking.customer_name}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-10 text-sm text-black/55">No bookings today.</p>
        )}
      </div>
    </main>
  );
}
