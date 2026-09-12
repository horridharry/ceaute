import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerBooking } from "../actions";

const canShowExactAddress = (booking) =>
  booking.status === "confirmed" || booking.status === "completed";

function ExactLocation({ booking }) {
  if (!canShowExactAddress(booking)) {
    return <p className="mt-3 text-black/60">Area: {booking.public_area}</p>;
  }

  const addressLines = [
    booking.address_line_1,
    booking.address_line_2,
    booking.city,
    booking.postcode,
  ].filter(Boolean);

  return (
    <div className="mt-4 border-t pt-4">
      <p className="font-semibold">Location</p>
      <p className="mt-2 text-black/60">Area: {booking.public_area}</p>
      {addressLines.length ? (
        <p className="mt-2 whitespace-pre-line">{addressLines.join("\n")}</p>
      ) : (
        <p className="mt-2 text-black/60">Exact address unavailable.</p>
      )}
      {booking.access_instructions ? (
        <p className="mt-2 text-black/60">
          Access: {booking.access_instructions}
        </p>
      ) : null}
    </div>
  );
}

export default async function CustomerBookingPage({ params }) {
  const { bookingId } = await params;
  const booking = await getCustomerBooking(bookingId);

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
            href="/account/bookings"
            className="text-sm font-semibold text-pink-600"
          >
            Back
          </Link>
        </div>

        <section className="mt-6 rounded-xl border p-4 text-sm">
          <h2 className="text-lg font-semibold">{booking.provider_name}</h2>
          <p className="mt-3 font-medium">{booking.treatment_name}</p>
          <p className="mt-3">
            <span className="font-semibold">{booking.date_label}</span>
            {", "}
            <span className="font-semibold">{booking.time_label}</span>
          </p>
          <p className="text-black/60">Duration: {booking.duration_label}</p>
          <p className="mt-3 font-medium">
            Total: {booking.total_price_label}
          </p>
          <p className="text-black/60">
            Paid online: {booking.amount_paid_online_label}
          </p>
          <p className="text-black/60">
            Due at appointment: {booking.amount_due_at_appointment_label}
          </p>
          <p className="text-xs text-black/60">{booking.status_label}</p>

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

          <ExactLocation booking={booking} />

          <div className="mt-4 border-t pt-4">
            <p className="font-semibold">Cancellation terms</p>
            <p className="mt-2 text-black/60">
              Cancellation window: {booking.cancellation_window_hours} hours
            </p>
            <p className="mt-2 whitespace-pre-line text-black/60">
              {booking.written_policy || "No written policy stored."}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

