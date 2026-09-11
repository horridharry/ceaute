import Link from "next/link";
import { notFound } from "next/navigation";
import { getProviderBooking } from "../actions";

export default async function ProviderBookingPage({ params }) {
  const { bookingId } = await params;
  const booking = await getProviderBooking(bookingId);

  if (!booking) {
    notFound();
  }

  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-bold tracking-tight text-black/80">
            Booking details
          </h1>
          <Link
            href="/provider/bookings"
            className="text-sm font-semibold text-pink-600"
          >
            Back
          </Link>
        </div>

        <section className="mt-6 rounded-xl border p-4 text-sm">
          <h2 className="text-lg font-semibold">{booking.customer_name}</h2>
          <p className="mt-3 font-medium">{booking.treatment_name}</p>
          <p className="mt-3">
            <span className="font-semibold">{booking.date_label}</span>
            {", "}
            <span className="font-semibold">{booking.time_label}</span>
          </p>
          <p className="text-black/60">Duration: {booking.duration_label}</p>
          <p className="mt-3 font-medium">{booking.total_price_label}</p>
          <p className="text-xs capitalize text-black/60">{booking.status}</p>
          <p className="mt-3 text-black/60">Area: {booking.public_area}</p>

          {booking.selected_add_ons.length ? (
            <div className="mt-4 border-t pt-4">
              <p className="font-semibold">Add-ons</p>
              <ul className="mt-2 flex flex-col gap-2">
                {booking.selected_add_ons.map((addOn) => (
                  <li key={addOn.id}>
                    {addOn.name} ({addOn.price_label}, {addOn.duration_label})
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
