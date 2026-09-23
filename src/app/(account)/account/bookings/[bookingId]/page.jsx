import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BookingInspirationImages } from "@/components/booking-inspiration-images";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button-classes";
import { Disclosure } from "@/components/ui/disclosure";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import {
  cancellationPreview,
  formatDeadline,
  formatPounds,
  lateCancellationSentence,
  snapshotPriceLines,
  termsFromSnapshot,
} from "@/lib/bookings/booking-money";
import { heldBookingPath } from "@/lib/bookings/held-booking-path";
import { legalIdentity } from "@/lib/legal/identity";
import { formatAppointmentWhen, formatDurationMinutes } from "@/features/storefront/format";
import {
  addBookingInspirationImages,
  removeBookingInspirationImageAction,
} from "../actions";
import { CancelBooking } from "../_components/cancel-booking";
import { ReviewForm } from "../_components/review-form";
import { getCustomerBooking } from "../queries";

const BACK = { href: "/account/bookings", label: "My bookings" };

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

function Section({ title, id, children }) {
  return (
    <section aria-labelledby={id} className="mt-10 flex flex-col gap-3 text-sm">
      <h2 id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Rows({ rows }) {
  return (
    <dl className="flex flex-col">
      {rows.map(([label, value, strong]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-line py-2.5 tabular-nums last:border-b-0">
          <dt className={strong ? "font-semibold" : "text-ink-muted"}>{label}</dt>
          <dd className={strong ? "font-semibold" : ""}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The refund's state, never a promise about when it arrives.
function refundSentence(paymentStatus, refundPence) {
  const amount = formatPounds(refundPence);

  switch (paymentStatus) {
    case "refund_required":
      return `Refund of ${amount}: pending.`;
    case "refunded":
      return `${amount} refunded to the card you paid with.`;
    case "refund_failed":
      return `We couldn’t refund ${amount} automatically. Email ${legalIdentity.contactEmail} and we’ll put it right.`;
    default:
      return `Refund of ${amount}: pending.`;
  }
}

function WhenAndWhere({ booking }) {
  const addressLines = canShowExactAddress(booking)
    ? [booking.address_line_1, booking.address_line_2, [booking.city, booking.postcode].filter(Boolean).join(" ")].filter(Boolean)
    : [];

  return (
    <section aria-label="When and where" className="mt-6 flex flex-col gap-1 text-sm">
      <p className="text-base font-semibold">{formatAppointmentWhen(booking.start_at, booking.end_at)}</p>
      <p className="text-ink-muted">{formatDurationMinutes(booking.duration_minutes)}</p>
      {addressLines.length ? (
        <p className="mt-2 whitespace-pre-line">{addressLines.join("\n")}</p>
      ) : (
        <p className="mt-2">{booking.public_area}</p>
      )}
      {canShowExactAddress(booking) && booking.access_instructions ? (
        <p className="text-ink-muted">{booking.access_instructions}</p>
      ) : null}
    </section>
  );
}

function WithProvider({ booking }) {
  if (!booking.provider_username) {
    return <p className="mt-2 text-sm text-ink-muted">With {booking.provider_name}</p>;
  }

  return (
    <p className="mt-2 text-sm text-ink-muted">
      With{" "}
      <Link href={`/@${booking.provider_username}`} className="font-semibold text-accent underline-offset-2 hover:underline">
        {booking.provider_name}
      </Link>
    </p>
  );
}

function Treatment({ booking }) {
  const lines = snapshotPriceLines(booking.service_snapshot);

  return (
    <Section title="Treatment" id="treatment">
      <Rows
        rows={[
          ...lines.map((line) => [line.addOn ? `+ ${line.label}` : line.label, line.price]),
          ["Total", booking.total_price_label, true],
        ]}
      />
    </Section>
  );
}

// A hold that ended with nothing paid. It is in no list; its link still says
// what happened.
function EndedHold({ booking }) {
  return (
    <PageContainer>
      <PageHeading back={BACK} title="This held time ended" description="Nothing was charged." />
      <WithProvider booking={booking} />
      <WhenAndWhere booking={booking} />
      <Treatment booking={booking} />
      {booking.provider_username ? (
        <p className="mt-8">
          <Link href={`/@${booking.provider_username}`} className={buttonClassName({ variant: "primary" })}>
            Book again
          </Link>
        </p>
      ) : null}
    </PageContainer>
  );
}

// A payment that arrived after the hold ended: no booking was made and the
// money goes back in full.
function RefundedLatePayment({ booking }) {
  const paid = booking.paid_attempt;
  const refund = paid.refund_amount_pence || paid.amount_charged_pence;

  return (
    <PageContainer>
      <PageHeading back={BACK} title={booking.treatment_name} />
      <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
        <Badge tone="quiet">{paid.payment_status === "refunded" ? "Payment refunded" : "Late payment"}</Badge>
      </p>
      <WithProvider booking={booking} />
      <p className="mt-6 text-sm">
        Your payment arrived after the held time ended, so this booking wasn’t made.
        {" "}
        {refundSentence(paid.payment_status, refund)}
      </p>
      <WhenAndWhere booking={booking} />
      {booking.provider_username ? (
        <p className="mt-8">
          <Link href={`/@${booking.provider_username}`} className={buttonClassName({ variant: "primary" })}>
            Choose a new time
          </Link>
        </p>
      ) : null}
    </PageContainer>
  );
}

function StatusLine({ booking }) {
  const badge =
    booking.view === "cancelled" ? (
      <Badge tone="quiet">
        {booking.cancelled_by === "provider" ? `Cancelled by ${booking.provider_name}` : "Cancelled by you"}
      </Badge>
    ) : booking.view === "past" ? (
      <Badge tone="quiet">Completed</Badge>
    ) : (
      <Badge>Confirmed</Badge>
    );

  return <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">{badge}</p>;
}

function Payment({ booking, terms }) {
  if (booking.view === "cancelled") {
    const refundPence = Number(booking.refund_amount_pence) || 0;
    const refundState = refundPence > 0 ? refundSentence(booking.paid_attempt?.payment_status, refundPence) : "";

    return (
      <Section title="Payment" id="payment">
        <Rows
          rows={[
            ["Paid online", booking.amount_paid_online_label],
            ["Refund", formatPounds(refundPence)],
            [`Kept by ${booking.provider_name}`, formatPounds(booking.retained_amount_pence)],
          ]}
        />
        {refundState ? <p className="text-ink-muted">{refundState}</p> : null}
      </Section>
    );
  }

  return (
    <Section title="Payment" id="payment">
      <Rows
        rows={[
          ["Paid online", formatPounds(terms.dueNowPence)],
          ...(terms.dueLaterPence > 0
            ? [[`Pay ${booking.provider_name} at the appointment`, formatPounds(terms.dueLaterPence), true]]
            : []),
        ]}
      />
    </Section>
  );
}

function Cancellation({ booking, terms }) {
  if (booking.view !== "upcoming") {
    return booking.written_policy ? (
      <Disclosure summary={`${booking.provider_name}’s booking policy`} className="mt-8">
        <p className="whitespace-pre-line">{booking.written_policy}</p>
      </Disclosure>
    ) : null;
  }

  return (
    <Section title="Cancellation" id="cancellation">
      <p>
        Free cancellation until <strong>{formatDeadline(booking.start_at, terms.windowHours)}</strong>,{" "}
        {terms.windowHours} hours before. After that, {lateCancellationSentence(terms, booking.provider_name)} If{" "}
        {booking.provider_name} cancels, you get everything back.
      </p>
      {booking.written_policy ? (
        <Disclosure summary={`${booking.provider_name}’s booking policy`}>
          <p className="whitespace-pre-line">{booking.written_policy}</p>
        </Disclosure>
      ) : null}
    </Section>
  );
}

function Review({ booking }) {
  if (booking.status !== "completed") {
    return null;
  }

  if (booking.review) {
    return (
      <Section title="Your review" id="review">
        <p>{booking.review.rating} out of 5</p>
        {booking.review.comment ? (
          <p className="whitespace-pre-line text-ink-muted">{booking.review.comment}</p>
        ) : null}
        {booking.review.is_visible ? null : (
          <p className="text-xs text-ink-muted">Hidden by Ceaute support.</p>
        )}
      </Section>
    );
  }

  return (
    <Section title="Leave a review" id="review">
      <ReviewForm bookingId={booking.booking_id} />
    </Section>
  );
}

export default async function CustomerBookingPage({ params, searchParams }) {
  const { bookingId } = await params;
  const query = await searchParams;
  const booking = await getCustomerBooking(bookingId);

  if (!booking) {
    notFound();
  }

  // A hold still waiting for payment is finished on its held page.
  if (booking.view === "hold" && booking.treatment_id && booking.provider_username) {
    redirect(
      heldBookingPath({
        username: booking.provider_username,
        treatmentId: booking.treatment_id,
        startAt: new Date(booking.start_at).toISOString(),
        addOnIds: booking.selected_add_ons.map((addOn) => addOn.id),
        holdId: booking.booking_id,
      }),
    );
  }

  if (!booking.confirmed_at) {
    return booking.paid_attempt ? <RefundedLatePayment booking={booking} /> : <EndedHold booking={booking} />;
  }

  const terms = termsFromSnapshot(booking.service_snapshot, {
    amountPaidPence: booking.amount_paid_online_pence ?? 0,
  });
  const justBooked = query?.checkout === "success" && booking.view === "upcoming";

  return (
    <PageContainer>
      <PageHeading back={BACK} title={justBooked ? "You’re booked" : booking.treatment_name} />
      {justBooked ? (
        <p className="mt-2 text-sm text-ink-muted">
          {booking.treatment_name} with {booking.provider_name}. The address is below.
        </p>
      ) : (
        <>
          <StatusLine booking={booking} />
          <WithProvider booking={booking} />
        </>
      )}

      <WhenAndWhere booking={booking} />
      <Treatment booking={booking} />
      <Payment booking={booking} terms={terms} />

      {booking.can_manage_inspiration_images || booking.inspiration_images.length ? (
        <BookingInspirationImages
          images={booking.inspiration_images}
          allowance={booking.inspiration_allowance}
          canManage={booking.can_manage_inspiration_images}
          addAction={addBookingInspirationImages}
          removeAction={removeBookingInspirationImageAction}
          hiddenFields={{ booking_id: booking.booking_id }}
          description={
            booking.can_manage_inspiration_images
              ? `Optional. Show ${booking.provider_name} the look you want: up to five photos, until your appointment starts.`
              : `The photos you shared with ${booking.provider_name}. They can’t be changed now.`
          }
        />
      ) : null}

      <Cancellation booking={booking} terms={terms} />
      {/* Kept in the same place whatever the booking's state, so the outcome
          of cancelling stays on screen after the page refreshes. */}
      {booking.view === "upcoming" || booking.status === "cancelled" ? (
        <CancelBooking
          bookingId={booking.booking_id}
          canCancel={booking.can_cancel && booking.view === "upcoming"}
          preview={cancellationPreview(terms, {
            startAt: booking.start_at,
            providerName: booking.provider_name,
          })}
        />
      ) : null}
      <Review booking={booking} />
    </PageContainer>
  );
}
