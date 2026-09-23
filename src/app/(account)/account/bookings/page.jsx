import Link from "next/link";
import { buttonClassName } from "@/components/ui/button-classes";
import { Card, CardLink } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LinkFilterPills } from "@/components/ui/filter-pills";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { customerBookingViewFromParam } from "@/lib/bookings/booking-display";
import { formatPounds } from "@/lib/bookings/booking-money";
import { formatShortDateTime, formatTimeLabel } from "@/features/storefront/format";
import { continueHoldPayment } from "./actions";
import { getCustomerBookings } from "./queries";

// My bookings (Specification §10). Holds still waiting for payment come
// first; a hold that ended with nothing paid is in no list.
const VIEWS = [
  { key: "upcoming", label: "Upcoming", empty: "No upcoming bookings." },
  { key: "past", label: "Past", empty: "No past bookings." },
  { key: "cancelled", label: "Cancelled", empty: "No cancelled bookings." },
];

const discoverLink = (
  <Link href="/discover" className={buttonClassName({ variant: "secondary" })}>
    Discover providers
  </Link>
);

function treatmentLine(booking) {
  return [booking.treatment_name, ...booking.selected_add_ons.map((addOn) => addOn.name)].join(" + ");
}

// What happened to the money, from the refund's own state; a refund that
// failed or has not happened yet is never called "refunded".
function refundState(booking, refundPence) {
  const amount = formatPounds(refundPence);

  switch (booking.paid_attempt?.payment_status) {
    case "refunded":
      return `${amount} refunded`;
    case "refund_failed":
      return `refund of ${amount} failed`;
    default:
      return `${amount} refund pending`;
  }
}

function statusLine(booking, view) {
  if (view === "upcoming") {
    const paid = Number(booking.amount_paid_online_pence) || 0;
    const later = Number(booking.amount_due_at_appointment_pence) || 0;
    return [paid > 0 ? `Paid ${formatPounds(paid)}` : "", later > 0 ? `${formatPounds(later)} at the appointment` : ""]
      .filter(Boolean)
      .join(" · ");
  }

  if (view === "past") {
    return "Completed";
  }

  // A payment that arrived after the hold ended: no booking was made.
  if (!booking.confirmed_at) {
    const paid = booking.paid_attempt;
    const refund = Number(paid?.refund_amount_pence || paid?.amount_charged_pence) || 0;
    return paid?.payment_status === "refunded" ? "Payment refunded" : `Late payment · ${refundState(booking, refund)}`;
  }

  const refund = Number(booking.refund_amount_pence) || 0;
  const by = booking.cancelled_by === "provider" ? `Cancelled by ${booking.provider_name}` : "Cancelled by you";
  return refund > 0 ? `${by} · ${refundState(booking, refund)}` : by;
}

function HoldCard({ booking }) {
  return (
    <Card as="article" padding="sm">
      <h3 className="font-semibold">{booking.provider_name}</h3>
      <p className="mt-1 text-sm">{treatmentLine(booking)}</p>
      <p className="mt-1 text-sm font-semibold">{formatShortDateTime(booking.start_at)}</p>
      <p className="mt-2 text-sm text-ink-muted">
        Held until {formatTimeLabel(new Date(booking.hold_expires_at))}. Nothing has been charged yet.
      </p>
      <form action={continueHoldPayment} className="mt-3">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <PendingButton pendingLabel="Opening payment…">Continue to payment</PendingButton>
      </form>
    </Card>
  );
}

function BookingCard({ booking, view }) {
  const status = statusLine(booking, view);

  return (
    <CardLink href={`/account/bookings/${booking.booking_id}`} padding="sm">
      <h3 className="font-semibold">{booking.provider_name}</h3>
      <p className="mt-1 text-sm">{treatmentLine(booking)}</p>
      <p className="mt-1 text-sm font-semibold">{formatShortDateTime(booking.start_at)}</p>
      {status ? <p className="mt-2 text-sm text-ink-muted">{status}</p> : null}
    </CardLink>
  );
}

export default async function CustomerBookingsPage({ searchParams }) {
  const params = await searchParams;
  const requested = Array.isArray(params?.view) ? params.view[0] : params?.view;
  const view = VIEWS.find((candidate) => candidate.key === customerBookingViewFromParam(requested));
  const groups = await getCustomerBookings();
  const hasAny = groups.hold.length + groups.upcoming.length + groups.past.length + groups.cancelled.length > 0;
  const bookings = groups[view.key];

  return (
    <PageContainer>
      <PageHeading title="My bookings" />

      {!hasAny ? (
        <EmptyState variant="bounded" className="mt-6" action={discoverLink}>
          No bookings yet.
        </EmptyState>
      ) : (
        <>
          {groups.hold.length ? (
            <section aria-labelledby="finish-heading" className="mt-6">
              <h2 id="finish-heading" className="text-lg font-semibold tracking-tight">
                Finish booking
              </h2>
              <ul className="mt-3 flex flex-col gap-3">
                {groups.hold.map((booking) => (
                  <li key={booking.booking_id}>
                    <HoldCard booking={booking} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <LinkFilterPills
            label="Filter bookings"
            value={view.key}
            className="mt-6"
            options={VIEWS.map((candidate) => ({
              key: candidate.key,
              label: candidate.label,
              href: candidate.key === "upcoming" ? "/account/bookings" : `/account/bookings?view=${candidate.key}`,
              count: groups[candidate.key].length,
            }))}
          />

          {bookings.length === 0 ? (
            <EmptyState className="mt-6" action={view.key === "upcoming" ? discoverLink : null}>
              {view.empty}
            </EmptyState>
          ) : (
            <ul className="mt-4 flex flex-col gap-3">
              {bookings.map((booking) => (
                <li key={booking.booking_id}>
                  <BookingCard booking={booking} view={view.key} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageContainer>
  );
}
