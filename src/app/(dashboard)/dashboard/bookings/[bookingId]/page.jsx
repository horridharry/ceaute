import { notFound } from "next/navigation";
import {
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { ButtonLink } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoNotice, ProblemNotice } from "@/components/ui/notice";
import { StatusDot } from "@/components/ui/status";
import { SubmitButton } from "@/components/ui/submit-button";
import { SummaryCard, SummaryLine } from "@/components/ui/summary-card";
import { StackedTopBar } from "@/components/ui/top-bar";
import { cancelProviderBooking, getProviderBooking } from "../actions";

const canShowExactAddress = (booking) =>
  Boolean(booking.confirmed_at) &&
  (booking.status === "confirmed" || booking.status === "completed");

// The customer's phone is only a link when there is a number to call. D10:
// there is no Message button — provider replies are not a product flow, and a
// button that does nothing is worse than no button.
function telHref(phone) {
  const digits = String(phone ?? "").replace(/[^\d+]/g, "");

  return digits.length > 5 ? `tel:${digits}` : null;
}

function Cancellation({ booking }) {
  if (booking.status === "cancelled") {
    return (
      <DetailSection heading="Cancellation">
        <p className="text-body text-black/80">
          Cancelled by {booking.cancelled_by_label} on {booking.cancelled_at_label}.
        </p>
        <SummaryCard>
          <SummaryLine label="Refunded" value={booking.refund_amount_label} />
          <SummaryLine
            label="Retained"
            value={booking.retained_amount_label}
            total
          />
        </SummaryCard>
        {booking.refund_status_label ? (
          <StatusDot
            status={booking.payment_status}
            label={booking.refund_status_label}
          />
        ) : null}
        {booking.payment_status === "refund_failed" ? (
          <ProblemNotice title="The automatic refund failed">
            Support reviews this payment. Nothing is needed from you.
          </ProblemNotice>
        ) : null}
      </DetailSection>
    );
  }

  if (!booking.can_cancel) {
    return null;
  }

  return (
    <DetailSection heading="Cancel as provider">
      <p className="text-body text-black/80">
        Refunds her full {booking.provider_refund_label} regardless of timing,
        and frees the slot immediately. She is emailed.
      </p>
      <form action={cancelProviderBooking} className="flex flex-col gap-3">
        <input type="hidden" name="booking_id" value={booking.booking_id} />
        <Checkbox
          name="acknowledged"
          required
          label="I understand this cancels the booking and refunds the customer."
        />
        <SubmitButton variant="destructive" pendingLabel="Cancelling">
          Cancel booking · refund {booking.provider_refund_label}
        </SubmitButton>
      </form>
    </DetailSection>
  );
}

export default async function BookingDetailPage({ params }) {
  const { bookingId } = await params;
  const booking = await getProviderBooking(bookingId);

  if (!booking) {
    notFound();
  }

  const call = telHref(booking.customer_phone);
  const addressLines = [
    booking.address_line_1,
    booking.address_line_2,
    [booking.city, booking.postcode].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <DetailTemplate
      nav={<StackedTopBar backHref="/dashboard/bookings" backLabel="Bookings" />}
      title={booking.customer_name}
      meta={`${booking.treatment_name} · ${booking.date_label} · ${booking.time_label}`}
    >
      <div className="flex flex-col gap-3">
        <StatusDot status={booking.status} label={booking.status_label} />
        <p className="text-[12.5px] text-black/50">{booking.duration_label}</p>
        {call ? (
          <ButtonLink href={call} variant="secondary" block={false} className="w-max px-6">
            Call {booking.customer_phone}
          </ButtonLink>
        ) : null}
      </div>

      <DetailSection heading="What she booked">
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
            label="Paid online → your Stripe"
            value={booking.amount_paid_online_label}
          />
          <SummaryLine
            label="Collect on the day"
            value={booking.amount_due_at_appointment_label}
            total
          />
        </SummaryCard>
      </DetailSection>

      <DetailSection heading="Customer">
        <p className="text-body text-black/80">{booking.customer_name}</p>
        <p className="text-[12.5px] text-black/60">{booking.customer_email}</p>
        <p className="text-[12.5px] text-black/60">{booking.customer_phone}</p>
        <p className="text-[12.5px] text-black/45">
          Contact details are the ones she gave at booking.
        </p>
      </DetailSection>

      <DetailSection heading="Where">
        {canShowExactAddress(booking) && addressLines.length ? (
          <>
            <p className="whitespace-pre-line text-body text-black/80">
              {addressLines.join("\n")}
            </p>
            {booking.access_instructions ? (
              <p className="text-[12.5px] text-black/60">
                {booking.access_instructions}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-body text-black/80">{booking.public_area}</p>
        )}
      </DetailSection>

      <DetailSection heading="Booked under">
        <p className="text-body text-black/80">
          {booking.cancellation_window_hours}-hour cancellation window. These
          terms are frozen for this booking even if you change your settings.
        </p>
        {booking.written_policy ? (
          <InfoNotice>{booking.written_policy}</InfoNotice>
        ) : null}
      </DetailSection>

      <Cancellation booking={booking} />
    </DetailTemplate>
  );
}
