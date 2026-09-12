import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelCustomerBooking,
  getCustomerBooking,
  submitBookingReview,
} from "../actions";

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

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
        Before {booking.cancellation_deadline_label}, cancelling refunds{" "}
        {booking.customer_early_refund_label}. At or after that time, Ceaute
        refunds {booking.customer_late_refund_label} and retains{" "}
        {booking.customer_late_retained_label}.
      </p>
      <p className="mt-3 font-medium">
        Cancelling now refunds {booking.customer_current_refund_label} and
        retains {booking.customer_current_retained_label}.
      </p>
      <form action={cancelCustomerBooking} className="mt-4">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <label className="mb-4 flex gap-2 text-sm text-black/70">
          <input type="checkbox" required className="mt-1 h-4 w-4" />
          <span>I understand this cancellation and refund outcome.</span>
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

function ExistingReview({ review }) {
  if (!review) {
    return null;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="font-semibold">Your review</p>
      <p className="mt-2 text-sm">Rating: {review.rating}/5</p>
      {review.comment ? (
        <p className="mt-2 whitespace-pre-line text-sm text-black/70">
          {review.comment}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-black/50">
        {review.is_visible ? "Visible publicly" : "Hidden by Ceaute support"}
      </p>
    </div>
  );
}

function ReviewPanel({ booking }) {
  if (booking.status !== "completed") {
    return null;
  }

  if (booking.review) {
    return <ExistingReview review={booking.review} />;
  }

  return (
    <div className="mt-4 border-t pt-4">
      <p className="font-semibold">Leave a review</p>
      <form action={submitBookingReview} className="mt-4 flex flex-col gap-3">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <label htmlFor="rating" className="label">
          Rating
        </label>
        <select id="rating" name="rating" className="input" required>
          <option value="">Choose a rating</option>
          <option value="5">5 stars</option>
          <option value="4">4 stars</option>
          <option value="3">3 stars</option>
          <option value="2">2 stars</option>
          <option value="1">1 star</option>
        </select>
        <label htmlFor="comment" className="label">
          Comment
        </label>
        <textarea
          id="comment"
          name="comment"
          maxLength={1000}
          rows={4}
          className="input"
        />
        <button
          type="submit"
          className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800"
        >
          Submit review
        </button>
      </form>
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

          <CancellationPanel booking={booking} />
          <ReviewPanel booking={booking} />
        </section>
      </div>
    </main>
  );
}
