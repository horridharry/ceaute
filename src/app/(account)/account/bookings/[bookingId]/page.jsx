import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingInspirationImages } from "@/components/booking-inspiration-images";
import { PendingButton } from "@/components/pending-button";
import { StatusBadge } from "@/app/(dashboard)/dashboard/_components/status-badge";
import { BOOKING_FALLBACK_LABEL } from "@/lib/bookings/booking-display";
import {
  addBookingInspirationImages,
  cancelCustomerBooking,
  getCustomerBooking,
  removeBookingInspirationImageAction,
  submitBookingReview,
} from "../actions";

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

// The appointment is over, or never happened. Used for the read-only
// inspiration treatment, which is about the booking being history rather than
// about any one status.
const isBookingHistory = (booking, now = Date.now()) =>
  booking.status === "completed" ||
  booking.status === "cancelled" ||
  booking.status === "expired" ||
  new Date(booking.end_at).getTime() < now;

// The snapshot stops returning the address once a booking is cancelled, so the
// screen says the address is gone rather than leaving a silent gap where it
// used to be.
function WhereWithoutAddress({ booking }) {
  const reason =
    booking.status === "cancelled" || booking.status === "expired"
      ? "exact address no longer shown"
      : "exact address appears once the booking is confirmed";

  return (
    <div className="mt-4 border-t border-black/8 pt-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
        Where
      </p>
      <p className="mt-2 text-black/60">
        {booking.public_area} · {reason}
      </p>
    </div>
  );
}

function ExactLocation({ booking, framed = false }) {
  if (!canShowExactAddress(booking)) {
    return <WhereWithoutAddress booking={booking} />;
  }

  const addressLines = [
    booking.address_line_1,
    booking.address_line_2,
    booking.city,
    booking.postcode,
  ].filter(Boolean);

  // On the confirmed screen the address is the thing the customer came for, so
  // it gets a panel of its own instead of another row in the summary.
  const shell = framed
    ? "mt-6 rounded-xl border border-black/12 p-4"
    : "mt-4 border-t border-black/8 pt-4";

  return (
    <div className={shell}>
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
        Where
      </p>
      {addressLines.length ? (
        <p className="mt-2 font-medium">{addressLines.join(", ")}</p>
      ) : (
        <p className="mt-2 text-black/60">
          {booking.public_area} · exact address unavailable
        </p>
      )}
      {booking.access_instructions ? (
        <p className="mt-1 text-sm text-black/60">
          {booking.access_instructions}
        </p>
      ) : null}
    </div>
  );
}

// warn while the refund is still moving, good once it has settled, bad when it
// failed. The reassurance line only appears on `refund_required`, because that
// is the only one the scheduled recovery pass actually retries:
// list_retryable_booking_refund_operations takes `requested`, `pending` and
// `processing` and excludes terminal ones, and `refund_failed` is terminal.
const REFUND_STATE = {
  refund_required: {
    tone: "warn",
    note: "The refund is retried automatically. Nothing is needed from you.",
  },
  refunded: { tone: "good", note: "" },
  refund_failed: {
    tone: "bad",
    note: "Support will review this payment. Nothing is needed from you yet.",
  },
};

function RefundState({ booking }) {
  const state = REFUND_STATE[booking.payment_status];

  if (!state || !booking.refund_status_label) {
    return null;
  }

  return (
    <>
      <StatusBadge tone={state.tone} className="mt-3">
        {booking.refund_status_label}
      </StatusBadge>
      {state.note ? (
        <p className="mt-1.5 text-black/60">{state.note}</p>
      ) : null}
    </>
  );
}

function CancellationPanel({ booking }) {
  if (booking.status === "cancelled") {
    return (
      <div className="mt-4 border-t border-black/8 pt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
          Refund
        </p>
        <p className="mt-2 text-black/60">
          Cancelled by {booking.cancelled_by_label} on{" "}
          {booking.cancelled_at_label}.
        </p>
        <p className="mt-2 flex justify-between">
          <span>Refunded</span>
          <span className="font-semibold tabular-nums">
            {booking.refund_amount_label}
          </span>
        </p>
        <p className="flex justify-between text-black/60">
          <span>Retained</span>
          <span className="tabular-nums">{booking.retained_amount_label}</span>
        </p>
        <RefundState booking={booking} />
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
        <PendingButton
          pendingLabel="Cancelling..."
          className="rounded-lg border border-rose-200 p-3 px-4 text-sm font-semibold text-rose-700 duration-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel booking
        </PendingButton>
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
        <select id="rating" name="rating" className="field cursor-pointer" required>
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
          className="field resize-none"
        />
        <PendingButton
          pendingLabel="Submitting..."
          className="w-max rounded-lg bg-accent-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Submit review
        </PendingButton>
      </form>
    </div>
  );
}

// The one screen with a voice: second person, her name, and the appointment
// stated as a sentence rather than a row of labelled fields.
function ConfirmedHeader({ booking }) {
  const firstName =
    booking.customer_name && booking.customer_name !== BOOKING_FALLBACK_LABEL
      ? booking.customer_name.split(" ")[0]
      : "";
  const opening = firstName ? `${firstName}, you are booked` : "You are booked";
  const money = Number.isInteger(booking.amount_paid_online_pence)
    ? booking.amount_due_at_appointment_pence > 0
      ? ` ${booking.amount_paid_online_label} paid, ${booking.amount_due_at_appointment_label} on the day.`
      : ` ${booking.amount_paid_online_label} paid in full.`
    : "";

  // The day name is enough in the sentence; the exact date is in the summary
  // below it.
  const when =
    !booking.weekday_label || booking.weekday_label === BOOKING_FALLBACK_LABEL
      ? booking.date_label
      : booking.weekday_label;

  return (
    <header>
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-600">
        Confirmed
      </p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">
        {opening} with {booking.provider_name} on {when} at{" "}
        {booking.start_time_label}.
      </h1>
      <p className="mt-2 text-sm text-black/60">
        {booking.treatment_name}.{money}
      </p>
    </header>
  );
}

export default async function CustomerBookingPage({ params }) {
  const { bookingId } = await params;
  const booking = await getCustomerBooking(bookingId);

  if (!booking) {
    notFound();
  }

  const isConfirmed = booking.status === "confirmed";
  const keptNotEditable =
    !booking.can_manage_inspiration_images && isBookingHistory(booking);

  return (
    <main className="container mx-auto max-w-md p-5">
      <div className="mt-12 flex flex-col">
        {isConfirmed ? (
          <ConfirmedHeader booking={booking} />
        ) : (
          // Nothing in the top right is a confirmed-screen rule, so the other
          // states keep the exit where it has always been.
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight text-black/80">
              Booking details
            </h1>
            <Link
              href="/account/bookings"
              className="text-sm font-semibold text-accent-600"
            >
              Back
            </Link>
          </div>
        )}

        {isConfirmed ? <ExactLocation booking={booking} framed /> : null}

        <section className="mt-6 rounded-xl border p-4 text-sm">
          {isConfirmed ? null : (
            <h2 className="text-lg font-semibold">{booking.provider_name}</h2>
          )}
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

          {isConfirmed ? null : <ExactLocation booking={booking} />}

          <BookingInspirationImages
            images={booking.inspiration_images}
            allowance={booking.inspiration_allowance}
            canManage={booking.can_manage_inspiration_images}
            addAction={addBookingInspirationImages}
            removeAction={removeBookingInspirationImageAction}
            hiddenFields={{ booking_id: booking.booking_id }}
            dimImages={keptNotEditable}
            description={
              booking.can_manage_inspiration_images
                ? "Optional pictures of the result you want, shared only with your provider."
                : keptNotEditable
                  ? "Kept with the booking. No longer editable."
                  : "The pictures shared with your provider for this appointment."
            }
          />

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

        {isConfirmed ? (
          <Link
            href="/account/bookings"
            className="mt-8 rounded-[11px] border border-black/16 py-3 text-center text-sm font-medium"
          >
            Go to my bookings
          </Link>
        ) : null}
      </div>
    </main>
  );
}
