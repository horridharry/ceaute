import { notFound } from "next/navigation";
import {
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CommitBar } from "@/components/ui/commit-bar";
import { Select, TextArea } from "@/components/ui/field";
import { InfoNotice, ProblemNotice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { StackedTopBar } from "@/components/ui/top-bar";
import {
  cancelCustomerBooking,
  getCustomerBooking,
  submitBookingReview,
} from "../actions";
import {
  BookingCancelledLetter,
  BookingConfirmedLetter,
} from "./_components/booking-letters";

// The exact address is released only after a paid, confirmed booking, and a
// cancelled booking loses it again. This mirrors the redaction the database
// already performs; it is not the only guard.
const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

function Where({ booking }) {
  if (!canShowExactAddress(booking)) {
    return (
      <p className="text-body text-black/80">
        {booking.public_area}
        {booking.status === "cancelled"
          ? " · exact address no longer shown"
          : " · full address is shared once your booking is confirmed"}
      </p>
    );
  }

  const addressLines = [
    booking.address_line_1,
    booking.address_line_2,
    [booking.city, booking.postcode].filter(Boolean).join(" "),
  ].filter(Boolean);

  const directions = addressLines.length
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(", "))}`
    : null;

  return (
    <>
      <p className="whitespace-pre-line text-body text-black/80">
        {addressLines.join("\n")}
      </p>
      {booking.access_instructions ? (
        <p className="text-[12.5px] text-black/60">
          {booking.access_instructions}
        </p>
      ) : null}
      {directions ? (
        <ButtonLink
          href={directions}
          variant="secondary"
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </ButtonLink>
      ) : null}
    </>
  );
}

function CancelledDetail({ booking }) {
  return (
    <DetailSection heading="Cancellation">
      <p className="text-body text-black/80">
        Cancelled by {booking.cancelled_by_label} on {booking.cancelled_at_label}.
      </p>
      <SummaryCard>
        <SummaryLine label="Refunded" value={booking.refund_amount_label} />
        <SummaryLine label="Retained" value={booking.retained_amount_label} total />
      </SummaryCard>
      {booking.refund_status_label ? (
        <StatusDot
          status={booking.payment_status}
          label={booking.refund_status_label}
        />
      ) : null}
      {booking.payment_status === "refund_failed" ? (
        <ProblemNotice title="The first refund attempt failed">
          Ceaute is retrying it and support is alerted. Nothing is needed from
          you — there is nothing to chase.
        </ProblemNotice>
      ) : null}
    </DetailSection>
  );
}

// The outcome is stated as two figures before anything is confirmed, and the
// acknowledgement is required. Rescheduling does not exist, so the copy says
// cancel-then-rebook rather than implying a move.
function CancelPanel({ booking }) {
  if (!booking.can_cancel) {
    return null;
  }

  return (
    <DetailSection heading="Cancel this booking">
      <SummaryCard>
        <SummaryLine
          label="Refunded to your card"
          value={booking.customer_current_refund_label}
        />
        <SummaryLine
          label={`Retained by ${booking.provider_name}`}
          value={booking.customer_current_retained_label}
          total
        />
      </SummaryCard>

      <p className="text-[12.5px]/[1.55] text-black/60">
        Before {booking.cancellation_deadline_label}, cancelling refunds{" "}
        {booking.customer_early_refund_label}. At or after that, Ceaute refunds{" "}
        {booking.customer_late_refund_label} and retains{" "}
        {booking.customer_late_retained_label}. Refunds usually take 5 to 10
        working days to show.
      </p>

      <p className="text-[12.5px]/[1.55] text-black/60">
        Rather move it? Cancel, then rebook — the refund covers it.
      </p>

      <form action={cancelCustomerBooking} className="flex flex-col gap-3">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <Checkbox
          name="acknowledged"
          label="I understand this cancellation and refund outcome."
          required
        />
        <SubmitButton variant="destructive" pendingLabel="Cancelling">
          Cancel booking
        </SubmitButton>
      </form>
    </DetailSection>
  );
}

function ReviewPanel({ booking }) {
  if (booking.status !== "completed") {
    return null;
  }

  if (booking.review) {
    return (
      <DetailSection heading="Your review">
        <StatusDot
          tone={booking.review.is_visible ? "ok" : "muted"}
          label={`${booking.review.rating}/5 · ${booking.review.is_visible ? "Visible on her page" : "Hidden by Ceaute support"}`}
        />
        {booking.review.comment ? (
          <p className="whitespace-pre-line text-body text-black/80">
            {booking.review.comment}
          </p>
        ) : null}
      </DetailSection>
    );
  }

  return (
    <DetailSection heading="How was it?">
      <form action={submitBookingReview} className="flex flex-col gap-[13px]">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <Select name="rating" label="Rating" required defaultValue="">
          <option value="" disabled>
            Choose a rating
          </option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} / 5
            </option>
          ))}
        </Select>
        <TextArea
          name="comment"
          label="Comment"
          optional
          maxLength={1000}
          helper="One review per booking. Shown by your first name on her page."
        />
        <SubmitButton pendingLabel="Submitting">Submit review</SubmitButton>
      </form>
    </DetailSection>
  );
}

export default async function CustomerBookingPage({ params, searchParams }) {
  const { bookingId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const booking = await getCustomerBooking(bookingId);

  if (!booking) {
    notFound();
  }

  const isConfirmed =
    booking.status === "confirmed" && Boolean(booking.confirmed_at);

  // The letter only ever follows a confirmed booking, and the checkout flow is
  // the only thing that sets `checkout=success`. An unconfirmed booking never
  // reaches this branch — the checkout page holds it on the confirming screen.
  if (resolvedSearchParams.checkout === "success" && isConfirmed) {
    return (
      <BookingConfirmedLetter
        booking={booking}
        customerName={booking.customer_name}
      />
    );
  }

  if (resolvedSearchParams.cancelled === "1" && booking.status === "cancelled") {
    return <BookingCancelledLetter booking={booking} />;
  }

  return (
    <DetailTemplate
      nav={<StackedTopBar backHref="/account/bookings" backLabel="Bookings" />}
      title={booking.treatment_name}
      meta={`${booking.provider_name} · ${booking.date_label} · ${booking.time_label}`}
      commitBar={
        booking.can_cancel ? null : booking.status === "cancelled" ? (
          <CommitBar>
            <ButtonLink href="/discover">Find another time</ButtonLink>
          </CommitBar>
        ) : null
      }
    >
      <div className="flex flex-col gap-3">
        <StatusDot status={booking.status} label={booking.status_label} />
        <p className="text-[12.5px] text-black/50">{booking.duration_label}</p>
      </div>

      <DetailSection heading="What you booked">
        <SummaryCard>
          <SummaryLine
            label={booking.treatment_name}
            value={booking.total_price_label}
          />
          {booking.selected_add_ons.map((addOn) => (
            <SummaryLine
              key={addOn.id}
              label={`+ ${addOn.name}`}
              value={addOn.price_label}
            />
          ))}
          <SummaryLine
            label="Paid online"
            value={booking.amount_paid_online_label}
          />
          <SummaryLine
            label="Due at appointment"
            value={booking.amount_due_at_appointment_label}
            total
          />
        </SummaryCard>
      </DetailSection>

      <DetailSection heading="Where">
        <Where booking={booking} />
      </DetailSection>

      <DetailSection heading="Booking terms">
        <p className="text-body text-black/80">
          Cancellation window {booking.cancellation_window_hours} hours. These
          terms are frozen for this booking.
        </p>
        {booking.written_policy ? (
          <InfoNotice>{booking.written_policy}</InfoNotice>
        ) : null}
      </DetailSection>

      {booking.status === "cancelled" ? (
        <CancelledDetail booking={booking} />
      ) : null}

      <CancelPanel booking={booking} />
      <ReviewPanel booking={booking} />
    </DetailTemplate>
  );
}
