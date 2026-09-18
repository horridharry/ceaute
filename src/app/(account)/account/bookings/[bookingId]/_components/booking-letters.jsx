import { ButtonLink } from "@/components/ui/button";
import {
  LetterPanel,
  LetterTemplate,
} from "@/components/templates/letter-template";
import { StatusDot } from "@/components/ui/status";

// T5 · Letter. Two of the three letter screens in the product. The voice only
// works because it is rare, so nothing else in the account area uses it.
//
// Directions is a maps link rather than an in-app action: on the day it is the
// most useful thing on the screen, and a maps URL needs no session. There is
// no "Add to calendar" — it would mean picking a calendar provider for the
// customer, and nothing in the product does that today.

function directionsHref(booking) {
  const address = [
    booking.address_line_1,
    booking.address_line_2,
    booking.city,
    booking.postcode,
  ]
    .filter(Boolean)
    .join(", ");

  return address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
}

function firstName(fullName) {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "";
}

export function BookingConfirmedLetter({ booking, customerName }) {
  const directions = directionsHref(booking);
  const greeting = firstName(customerName);
  const addressLines = [
    booking.address_line_1,
    booking.address_line_2,
    [booking.city, booking.postcode].filter(Boolean).join(" "),
  ].filter(Boolean);

  return (
    <LetterTemplate
      eyebrow="Confirmed"
      headline={`${greeting ? `${greeting}, you` : "You"}’re booked with ${booking.provider_name}.`}
      panel={
        <LetterPanel>
          <div className="flex flex-col gap-1">
            <span className="text-body-strong text-ink">
              {booking.treatment_name}
            </span>
            <span className="text-[12.5px] text-black/60">
              {booking.date_label} · {booking.time_label}
            </span>
            {addressLines.length ? (
              <span className="mt-2 text-[12.5px] text-black/60">
                {addressLines.join(", ")}
              </span>
            ) : null}
            {booking.access_instructions ? (
              <span className="text-[12.5px] text-black/60">
                {booking.access_instructions}
              </span>
            ) : null}
          </div>
        </LetterPanel>
      }
      actions={
        directions ? (
          <ButtonLink
            href={directions}
            variant="secondary"
            target="_blank"
            rel="noreferrer"
          >
            Directions
          </ButtonLink>
        ) : null
      }
      exit={
        <ButtonLink
          href={`/account/bookings/${booking.booking_id}`}
          variant="tertiary"
        >
          View booking
        </ButtonLink>
      }
    >
      {booking.amount_paid_online_label} paid;{" "}
      {booking.amount_due_at_appointment_label} on the day. The address is below
      and on the booking.
    </LetterTemplate>
  );
}

export function BookingCancelledLetter({ booking }) {
  const refunded =
    booking.refund_amount_label && booking.refund_amount_label !== "£0.00";

  return (
    <LetterTemplate
      eyebrow="Cancelled"
      headline={
        refunded
          ? `Your ${booking.refund_amount_label} is on its way back to your card.`
          : `${booking.date_label} with ${booking.provider_name} is cancelled.`
      }
      panel={
        <LetterPanel>
          <div className="flex flex-col gap-2">
            <span className="text-body-strong text-ink">
              {booking.treatment_name}
            </span>
            <span className="text-[12.5px] text-black/60">
              {booking.date_label} · {booking.time_label}
            </span>
            {booking.refund_status_label ? (
              <StatusDot
                status={booking.payment_status}
                label={booking.refund_status_label}
              />
            ) : null}
            <span className="text-[12.5px] text-black/60">
              Refunded {booking.refund_amount_label} · retained{" "}
              {booking.retained_amount_label}
            </span>
          </div>
        </LetterPanel>
      }
      actions={
        <ButtonLink href="/discover" variant="secondary">
          Pick another time
        </ButtonLink>
      }
      exit={
        <ButtonLink href="/account/bookings" variant="tertiary">
          Bookings
        </ButtonLink>
      }
    >
      {booking.date_label} with {booking.provider_name} is cancelled, and the
      time is free for someone else. Refunds usually take 5 to 10 working days
      to reach your card, and we&rsquo;ll email when it lands.
    </LetterTemplate>
  );
}
