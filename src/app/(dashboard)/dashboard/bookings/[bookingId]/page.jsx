import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button-classes";
import { Disclosure } from "@/components/ui/disclosure";
import { cancellationRefund, upcomingMoney } from "@/lib/bookings/booking-card-money";
import {
  BOOKING_FALLBACK_LABEL,
  formatMoneyFromPence,
  providerBookingView,
} from "@/lib/bookings/booking-display";
import { snapshotPriceLines } from "@/lib/bookings/booking-money";
import { DashboardPage } from "../../_components/dashboard-page";
import { formatShortDate, formatTimeRange } from "../../_lib/booking-format";
import { formatShortDuration } from "../../_lib/price-duration";
import { cancelProviderBooking } from "../actions";
import { getProviderBooking } from "../queries";
import { CancelBooking } from "./_components/cancel-booking";
import { InspirationGallery } from "./_components/inspiration-gallery";

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

const known = (value) => value && value !== BOOKING_FALLBACK_LABEL;

const isMinutes = (value) => Number.isInteger(value) && value > 0;

function ContactIcon({ kind }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {kind === "phone" ? (
        <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />
      ) : (
        <>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-10 6L2 7" />
        </>
      )}
    </svg>
  );
}

function StatusLine({ booking }) {
  const view = providerBookingView(booking);
  const badge =
    view === "cancelled" ? (
      <Badge tone="quiet">{booking.cancelled_by === "provider" ? "Cancelled by you" : "Cancelled by customer"}</Badge>
    ) : view === "completed" ? (
      <Badge tone="quiet">Completed</Badge>
    ) : (
      <Badge tone="attention">Confirmed</Badge>
    );

  return <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">{badge}</p>;
}

// The one amount that matters now (approved 23 September 2026), lifted into
// the summary; the Payment section below keeps the whole breakdown.
function LiveAmount({ booking }) {
  const view = providerBookingView(booking);

  if (view === "cancelled") {
    const refund = cancellationRefund(booking);
    if (!refund) return null;
    const [label, value, danger] =
      refund.kind === "refunded"
        ? ["Refunded to the customer", formatMoneyFromPence(refund.pence)]
        : refund.kind === "pending"
          ? [`Refund of ${formatMoneyFromPence(refund.pence)}`, "Pending"]
          : refund.kind === "failed"
            ? [`Refund of ${formatMoneyFromPence(refund.pence)}`, "Failed", true]
            : ["Refund", "None"];
    return (
      <p className={`mt-3 flex justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2.5 tabular-nums ${danger ? "text-danger" : ""}`}>
        <span>{label}</span>
        <span className="font-semibold">{value}</span>
      </p>
    );
  }

  if (view !== "upcoming") return null;
  const money = upcomingMoney(booking);
  if (!money) return null;

  return (
    <p className="mt-3 flex justify-between gap-3 rounded-lg bg-surface-subtle px-3 py-2.5 tabular-nums">
      {money.kind === "collect" ? (
        <>
          <span>To collect at the appointment</span>
          <span className="font-semibold">{formatMoneyFromPence(money.pence)}</span>
        </>
      ) : (
        <span>Paid in full online</span>
      )}
    </p>
  );
}

// The appointment first: when, how long, what, where, and the live amount.
function Summary({ booking }) {
  const addressLines = canShowExactAddress(booking)
    ? [booking.address_line_1, booking.address_line_2, [booking.city, booking.postcode].filter(Boolean).join(" ")].filter(Boolean)
    : [];
  const treatment = [booking.treatment_name, ...booking.selected_add_ons.map((addOn) => addOn.name)].join(" + ");

  return (
    <section aria-label="Appointment" className="mt-5 rounded-xl border border-line p-4 text-sm">
      <p className="text-base font-semibold tabular-nums">
        {formatShortDate(booking.start_at)} · {formatTimeRange(booking.start_at, booking.end_at)}
      </p>
      <p className="text-ink-muted">
        {isMinutes(booking.duration_minutes) ? formatShortDuration(booking.duration_minutes) : booking.duration_label}
      </p>
      <p className="mt-2 font-medium">{treatment}</p>
      {addressLines.length ? (
        <p className="mt-2 whitespace-pre-line">{addressLines.join("\n")}</p>
      ) : (
        <p className="mt-2">{booking.public_area}</p>
      )}
      {canShowExactAddress(booking) && booking.access_instructions ? (
        <p className="text-ink-muted">{booking.access_instructions}</p>
      ) : null}
      <LiveAmount booking={booking} />
    </section>
  );
}

// Call and Email, with the number and address still readable (the separate
// Customer section they replace showed them as text).
function Contact({ booking }) {
  const phone = known(booking.customer_phone) ? booking.customer_phone : "";
  const email = known(booking.customer_email) ? booking.customer_email : "";
  if (!phone && !email) return null;
  const active = booking.status !== "cancelled";

  return (
    <div className="mt-4">
      {active ? (
        <div className="flex gap-2">
          {phone ? (
            <a href={`tel:${phone.replace(/\s+/g, "")}`} className={buttonClassName({ variant: "secondary", className: "flex-1" })}>
              <ContactIcon kind="phone" />
              Call<span className="sr-only"> {booking.customer_name}</span>
            </a>
          ) : null}
          {email ? (
            <a href={`mailto:${email}`} className={buttonClassName({ variant: "secondary", className: "flex-1" })}>
              <ContactIcon kind="email" />
              Email<span className="sr-only"> {booking.customer_name}</span>
            </a>
          ) : null}
        </div>
      ) : null}
      <p className={`${active ? "mt-2" : ""} text-[13px] text-ink-muted [overflow-wrap:anywhere]`}>
        {[phone, email].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

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
      {rows.map(([label, value, strong], index) => (
        <div key={`${label}-${index}`} className="flex justify-between gap-4 border-b border-line py-2.5 tabular-nums last:border-b-0">
          <dt className={strong ? "font-semibold" : "text-ink-muted"}>{label}</dt>
          <dd className={strong ? "font-semibold" : ""}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// The receipt: every price line, what was paid online and what is left, or
// on a cancelled booking what was refunded and kept. Nothing here is hidden.
function Payment({ booking }) {
  const priceLines = snapshotPriceLines(booking.service_snapshot).map((line) => [
    line.addOn ? `+ ${line.label}` : line.label,
    line.price,
  ]);

  if (booking.status === "cancelled") {
    return (
      <Section title="Payment" id="payment">
        <Rows
          rows={[
            ...priceLines,
            ["Total", booking.total_price_label, true],
            ["Paid online", booking.amount_paid_online_label],
            ["Refunded", booking.refund_amount_label],
            ["Kept", booking.retained_amount_label],
          ]}
        />
        {booking.refund_status_label ? <p className="text-ink-muted">{booking.refund_status_label}.</p> : null}
        {booking.payment_status === "refund_failed" ? (
          <p className="text-danger">Automatic refund failed. Support will need to review this payment.</p>
        ) : null}
      </Section>
    );
  }

  return (
    <Section title="Payment" id="payment">
      <Rows
        rows={[
          ...priceLines,
          ["Total", booking.total_price_label, true],
          ["Paid online", booking.amount_paid_online_label],
          ...(booking.amount_due_at_appointment_pence > 0
            ? [["To collect", booking.amount_due_at_appointment_label, true]]
            : []),
        ]}
      />
    </Section>
  );
}

export default async function BookingDetailPage({ params }) {
  const { bookingId } = await params;
  const booking = await getProviderBooking(bookingId);

  // A missing booking and a hold both end here; see getProviderBooking.
  if (!booking) {
    notFound();
  }

  return (
    <DashboardPage
      title={booking.customer_name}
      size="md"
      back={{ href: "/dashboard/bookings", label: "Bookings" }}
    >
      <StatusLine booking={booking} />
      <Summary booking={booking} />
      <Contact booking={booking} />

      {booking.inspiration_images.length ? (
        <Section title="Inspiration" id="inspiration">
          <InspirationGallery images={booking.inspiration_images} />
        </Section>
      ) : null}

      <Payment booking={booking} />

      <Disclosure summary="Cancellation policy" className="mt-8">
        <p>Cancellation window: {booking.cancellation_window_hours} hours</p>
        <p className="whitespace-pre-line text-ink-muted">
          {booking.written_policy || "No written policy stored."}
        </p>
      </Disclosure>

      <CancelBooking
        bookingId={booking.booking_id}
        customerName={booking.customer_name}
        refundLabel={booking.provider_refund_label}
        canCancel={booking.can_cancel}
        cancelAction={cancelProviderBooking}
      />
    </DashboardPage>
  );
}
