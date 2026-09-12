import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelProviderBooking, getProviderBooking } from "../actions";

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

function CancellationPanel({ booking }) {
  if (booking.status === "cancelled") {
    return (
      <div className="mt-4 border-t pt-4">
        <p className="font-semibold">Cancellation</p>
        <p className="mt-2 text-black/60">
          Cancelled by {booking.cancelled_by_label} on{" "}
          {booking.cancelled_at_label}.
        </p>
        <p className="mt-2">Refunded: {booking.refund_amount_label}</p>
        <p className="text-black/60">Retained: {booking.retained_amount_label}</p>
        {booking.refund_status_label ? (
          <p className="mt-2 text-black/60">{booking.refund_status_label}</p>
        ) : null}
        {booking.payment_status === "refund_failed" ? (
          <p className="mt-2 text-red-600">
            Automatic refund failed. Support will need to review this payment.
          </p>
        ) : null}
      </div>
    );
  }

  if (!booking.can_cancel) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="font-semibold">Cancel booking</p>
      <p className="mt-2 text-black/60">
        Provider cancellation refunds the full amount paid online:{" "}
        {booking.provider_refund_label}. The appointment time is released as
        soon as the booking is cancelled.
      </p>
      <form action={cancelProviderBooking} className="mt-4">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <label className="mb-4 flex gap-2 text-sm text-black/70">
          <input type="checkbox" required className="mt-1 h-4 w-4" />
          <span>I understand this will cancel the booking and refund the customer.</span>
        </label>
        <button
          type="submit"
          className="rounded-lg border border-rose-200 p-3 px-4 text-sm font-semibold text-rose-700 duration-200 hover:bg-rose-50"
        >
          Cancel booking
        </button>
      </form>
    </div>
  );
}

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

          <div className="mt-4 border-t pt-4">
            <p className="font-semibold">Customer</p>
            <p className="mt-2">{booking.customer_name}</p>
            <p className="text-black/60">{booking.customer_email}</p>
            <p className="text-black/60">{booking.customer_phone}</p>
          </div>

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

          <CancellationPanel booking={booking} />
        </section>
      </div>
    </main>
  );
}
