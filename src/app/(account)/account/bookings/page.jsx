import Link from "next/link";
import { getCustomerBookings } from "./queries";

const NoBookings = () => (
  <div className="rounded-xl border p-4 text-sm text-black/60">
    You do not have any bookings yet.
  </div>
);

const BookingItem = ({ booking }) => (
  <Link href={`/account/bookings/${booking.booking_id}`}>
    <article className="rounded-xl border p-3 duration-200 hover:border-black/20 hover:bg-black/5">
      <h3 className="font-semibold">{booking.provider_name}</h3>
      <p className="mt-3 text-sm">{booking.treatment_name}</p>
      {booking.selected_add_ons.length ? (
        <p className="mt-1 text-sm text-black/60">
          Add-ons:{" "}
          {booking.selected_add_ons.map((addOn) => addOn.name).join(", ")}
        </p>
      ) : null}
      <p className="mt-3 text-sm font-semibold">
        {booking.date_label}, {booking.time_label}
      </p>
      <p className="mt-2 text-sm">Total: {booking.total_price_label}</p>
      <p className="text-sm text-black/60">
        Paid online: {booking.amount_paid_online_label}
      </p>
      <p className="text-sm text-black/60">
        Due at appointment: {booking.amount_due_at_appointment_label}
      </p>
      <p className="mt-2 text-xs text-black/60">{booking.status_label}</p>
    </article>
  </Link>
);

const BookingSection = ({ title, bookings }) => (
  <section className="mt-8">
    <h2 className="text-lg font-semibold">{title}</h2>
    <ul className="mt-3 flex flex-col gap-4">
      {bookings.map((booking) => (
        <li key={booking.booking_id}>
          <BookingItem booking={booking} />
        </li>
      ))}
      {bookings.length === 0 ? (
        <li className="rounded-xl border p-4 text-sm text-black/60">
          No bookings.
        </li>
      ) : null}
    </ul>
  </section>
);

export default async function CustomerBookingsPage() {
  const bookingGroups = await getCustomerBookings();
  const hasBookings =
    bookingGroups.upcoming.length > 0 ||
    bookingGroups.previous.length > 0 ||
    bookingGroups.cancelled.length > 0;

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Bookings</h1>

        <div className="mt-8">
          {!hasBookings ? <NoBookings /> : null}
          {hasBookings ? (
            <>
              <BookingSection title="Upcoming" bookings={bookingGroups.upcoming} />
              <BookingSection title="Previous" bookings={bookingGroups.previous} />
              <BookingSection
                title="Cancelled"
                bookings={bookingGroups.cancelled}
              />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
