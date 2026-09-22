import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { buttonClassName } from "@/components/ui/button-classes";
import { Disclosure } from "@/components/ui/disclosure";
import { BOOKING_FALLBACK_LABEL, providerBookingView } from "@/lib/bookings/booking-display";
import { DashboardPage } from "../../_components/dashboard-page";
import { formatShortDate, formatTimeRange, treatmentLine } from "../../_lib/booking-format";
import { cancelProviderBooking } from "../actions";
import { getProviderBooking } from "../queries";
import { CancelBooking } from "./_components/cancel-booking";
import { InspirationGallery } from "./_components/inspiration-gallery";

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

const known = (value) => value && value !== BOOKING_FALLBACK_LABEL;

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

  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
      {badge}
      {treatmentLine(booking)}
    </p>
  );
}

function WhenAndWhere({ booking }) {
  const addressLines = canShowExactAddress(booking)
    ? [booking.address_line_1, booking.address_line_2, [booking.city, booking.postcode].filter(Boolean).join(" ")].filter(Boolean)
    : [];

  return (
    <section aria-label="When and where" className="mt-6 flex flex-col gap-1 text-sm">
      <p className="text-base font-semibold tabular-nums">
        {formatShortDate(booking.start_at)} · {formatTimeRange(booking.start_at, booking.end_at)}
      </p>
      <p className="text-ink-muted">{booking.duration_label}</p>
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

function Contact({ booking }) {
  const phone = known(booking.customer_phone) ? booking.customer_phone : "";
  const email = known(booking.customer_email) ? booking.customer_email : "";
  if (booking.status === "cancelled" || (!phone && !email)) return null;

  return (
    <div className="mt-5 flex gap-2">
      {phone ? (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} className={buttonClassName({ variant: "secondary", className: "flex-1" })}>
          Call<span className="sr-only"> {booking.customer_name}</span>
        </a>
      ) : null}
      {email ? (
        <a href={`mailto:${email}`} className={buttonClassName({ variant: "secondary", className: "flex-1" })}>
          Email<span className="sr-only"> {booking.customer_name}</span>
        </a>
      ) : null}
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
      {rows.map(([label, value, strong]) => (
        <div key={label} className="flex justify-between gap-4 border-b border-line py-2.5 tabular-nums last:border-b-0">
          <dt className={strong ? "font-semibold" : "text-ink-muted"}>{label}</dt>
          <dd className={strong ? "font-semibold" : ""}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Payment({ booking }) {
  if (booking.status === "cancelled") {
    return (
      <Section title="Payment" id="payment">
        <Rows
          rows={[
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
          ["Paid online", booking.amount_paid_online_label],
          ...(booking.amount_due_at_appointment_pence > 0
            ? [["To collect", booking.amount_due_at_appointment_label, true]]
            : []),
          ["Total", booking.total_price_label],
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
      <WhenAndWhere booking={booking} />
      <Contact booking={booking} />

      <Section title="Treatment" id="treatment">
        <Rows
          rows={[
            [booking.treatment_name, "", false],
            ...booking.selected_add_ons.map((addOn) => [addOn.name, `+${addOn.price_label} · +${addOn.duration_label}`]),
          ]}
        />
      </Section>

      {booking.inspiration_images.length ? (
        <Section title="Inspiration" id="inspiration">
          <InspirationGallery images={booking.inspiration_images} />
        </Section>
      ) : null}

      <Section title="Customer" id="customer">
        <Rows
          rows={[
            ["Phone", booking.customer_phone],
            ["Email", booking.customer_email],
          ]}
        />
      </Section>

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
