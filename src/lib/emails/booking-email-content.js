import {
  formatMoneyFromPence,
  formatSingleDateTime,
} from "@/lib/bookings/booking-display";
import { renderEmailLayout } from "./email-layout";

const FALLBACK_SUBJECT = "Ceaute booking update";

const EVENT_TITLES = {
  booking_confirmed_customer: "Your booking is confirmed",
  booking_confirmed_provider: "New booking confirmed",
  customer_cancelled_customer: "Your booking was cancelled",
  customer_cancelled_provider: "A customer cancelled a booking",
  provider_cancelled_customer: "Your provider cancelled a booking",
  provider_cancelled_provider: "You cancelled a booking",
};

// HTML-only opening sentence; the plain-text alternative stays a list of facts.
// The link label per event. Every email but one says "View booking"; a
// customer whose provider cancelled needs a way forward, not a way back to a
// booking that is not happening. There is no "three others are free" line: it
// would need an availability query across providers that does not exist.
const EVENT_ACTION_LABELS = {
  provider_cancelled_customer: "Find another time",
};
const DEFAULT_ACTION_LABEL = "View booking";

const EVENT_INTROS = {
  booking_confirmed_customer:
    "You're all booked in. Here is everything you need for your appointment.",
  booking_confirmed_provider:
    "A customer has booked and paid. Here is everything you need for the appointment.",
  customer_cancelled_customer:
    "Your booking has been cancelled. Your refund details are below.",
  customer_cancelled_provider:
    "The customer cancelled this booking. The refund details are below.",
  provider_cancelled_customer:
    "Your provider cancelled this booking. Your full payment is being refunded — a provider cancellation never retains anything.",
  provider_cancelled_provider:
    "You cancelled this booking. The customer's refund details are below.",
};

export function bookingEmailSubject(email) {
  return EVENT_TITLES[email.event_type] ?? FALLBACK_SUBJECT;
}

// The link is only ever a path on our own site. Anything that resolves off
// the configured origin or to a non-web scheme (a "//host" or "javascript:"
// path in a payload) yields no link at all.
function safeBookingUrl(path, appUrl) {
  if (!appUrl || typeof path !== "string" || !path) {
    return "";
  }

  try {
    const base = new URL(appUrl);
    const url = new URL(path, base);
    const isWeb = url.protocol === "https:" || url.protocol === "http:";

    return isWeb && url.origin === base.origin ? url.toString() : "";
  } catch {
    return "";
  }
}

function bookingPath(payload, isProvider) {
  if (!isProvider) {
    return payload.customer_booking_path;
  }

  return payload.booking_id
    ? `/dashboard/bookings/${encodeURIComponent(payload.booking_id)}`
    : "";
}

function addOnsLabel(payload) {
  const addOns = Array.isArray(payload.selected_add_ons)
    ? payload.selected_add_ons
    : [];

  if (!addOns.length) {
    return "None";
  }

  return addOns.map((addOn) => addOn.name).filter(Boolean).join(", ");
}

function addressLines(payload) {
  return [
    payload.address_line_1,
    payload.address_line_2,
    payload.city,
    payload.postcode,
  ].filter(Boolean);
}

function refundStatusLabel(status) {
  if (status === "refunded") {
    return "Refund recorded";
  }

  if (status === "refund_failed") {
    return "Refund failed";
  }

  if (status === "refund_required") {
    return "Refund pending";
  }

  return "Refund status unavailable";
}

function row(label, value) {
  return { label, value: value || "Unavailable" };
}

// A row that belongs only in some emails; null rows are dropped below.
function optionalRow(label, value) {
  return value ? { label, value } : null;
}

function section(heading, rows, { highlight = false } = {}) {
  return { heading, highlight, rows: rows.filter((entry) => entry !== null) };
}

// One structured description of the email. The text and HTML renderers both
// read it, so a booking fact cannot appear in one alternative and not the other.
export function buildBookingEmailContent(email, appUrl) {
  const payload = email.payload ?? {};
  const isCancellation = String(email.event_type ?? "").includes("cancelled");
  const isProvider = email.recipient_role === "provider";
  const address = addressLines(payload);

  const sections = [
    section("Booking", [
      row("Provider", payload.provider_name),
      row("Customer", payload.customer_name),
      // Only the provider needs the customer's contact details.
      optionalRow("Customer email", isProvider ? payload.customer_email : ""),
      optionalRow("Customer phone", isProvider ? payload.customer_phone : ""),
      row("Treatment", payload.treatment_name),
      row("Add-ons", addOnsLabel(payload)),
      row("Appointment", `${formatSingleDateTime(payload.start_at)} - ${formatSingleDateTime(payload.end_at).split(", ").at(-1)}`),
    ]),
  ];

  if (!isCancellation) {
    sections.push(
      section("Payment", [
        row(
          isProvider ? "Paid to your Stripe" : "Amount paid",
          formatMoneyFromPence(payload.amount_paid_pence),
        ),
        row(
          isProvider ? "Collect on the day" : "Due at appointment",
          formatMoneyFromPence(payload.amount_due_later_pence),
        ),
        row("Cancellation deadline", formatSingleDateTime(payload.cancellation_deadline_at)),
      ]),
    );

    // B4: the provider does not need to be told her own street. The address
    // panel is for the customer only.
    if (!isProvider) {
      sections.push(
        section(
          "Where",
          [
            row("Address", address.join(", ")),
            row("Access instructions", payload.access_instructions),
          ],
          { highlight: true },
        ),
      );
    }
  } else {
    // The private address is deliberately absent from cancellation emails.
    sections.push(
      section("Payment", [
        row(
          isProvider ? "Paid to your Stripe" : "Amount paid",
          formatMoneyFromPence(payload.amount_paid_pence),
        ),
        row(
          isProvider ? "Collect on the day" : "Due at appointment",
          formatMoneyFromPence(payload.amount_due_later_pence),
        ),
      ]),
      section(
        "Cancellation and refund",
        [
          row("Cancelled by", payload.cancelled_by),
          row("Refund amount", formatMoneyFromPence(payload.refund_amount_pence)),
          row("Retained amount", formatMoneyFromPence(payload.retained_amount_pence)),
          row("Refund status", refundStatusLabel(payload.refund_status)),
        ],
        { highlight: true },
      ),
    );
  }

  return {
    title: bookingEmailSubject(email),
    intro: EVENT_INTROS[email.event_type] ?? "",
    badge: isCancellation ? "Booking cancelled" : "Booking confirmed",
    tone: isCancellation ? "neutral" : "positive",
    sections,
    actionLabel:
      EVENT_ACTION_LABELS[email.event_type] ?? DEFAULT_ACTION_LABEL,
    bookingUrl: safeBookingUrl(bookingPath(payload, isProvider), appUrl),
  };
}

export function renderBookingEmailText(email, appUrl) {
  const content = buildBookingEmailContent(email, appUrl);

  return [
    content.title,
    "",
    ...content.sections.flatMap((entry) =>
      entry.rows.map(({ label, value }) => `${label}: ${value}`),
    ),
    `${content.actionLabel}: ${content.bookingUrl || "Unavailable"}`,
  ].join("\n");
}

export function renderBookingEmailHtml(email, appUrl) {
  const content = buildBookingEmailContent(email, appUrl);

  return renderEmailLayout({
    title: content.title,
    preheader: content.intro,
    badge: content.badge,
    tone: content.tone,
    intro: content.intro,
    sections: content.sections,
    action: content.bookingUrl
      ? { label: content.actionLabel, url: content.bookingUrl }
      : null,
    footerNote:
      "You are receiving this email because of a booking made through Ceaute.",
  });
}
