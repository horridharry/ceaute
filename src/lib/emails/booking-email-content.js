import {
  BOOKING_FALLBACK_LABEL,
  formatDurationMinutes,
  formatMoneyFromPence,
  formatSingleDateTime,
} from "@/lib/bookings/booking-display";
import { renderEmailShell } from "./email-layout";

const FALLBACK_SUBJECT = "Ceaute booking update";
const TIME_ZONE = "Europe/London";

const EVENT_TITLES = {
  booking_confirmed_customer: "Your booking is confirmed",
  booking_confirmed_provider: "New booking confirmed",
  customer_cancelled_customer: "Your booking was cancelled",
  customer_cancelled_provider: "A customer cancelled a booking",
  provider_cancelled_customer: "Your provider cancelled a booking",
  provider_cancelled_provider: "You cancelled a booking",
};

export function bookingEmailSubject(email) {
  return EVENT_TITLES[email.event_type] ?? FALLBACK_SUBJECT;
}

function formatPart(value, options) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return BOOKING_FALLBACK_LABEL;
  }

  return new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, ...options }).format(date);
}

const formatWeekday = (value) => formatPart(value, { weekday: "long" });
const formatDayLong = (value) =>
  formatPart(value, { weekday: "long", day: "2-digit", month: "short", year: "numeric" });
const formatDayShort = (value) =>
  formatPart(value, { weekday: "short", day: "numeric", month: "short" });
const formatDateShort = (value) =>
  formatPart(value, { day: "2-digit", month: "short", year: "numeric" });
const formatTime = (value) =>
  formatPart(value, { hour: "numeric", minute: "2-digit", hourCycle: "h12" });

function durationLabel(startAt, endAt) {
  const start = new Date(startAt);
  const end = new Date(endAt);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return BOOKING_FALLBACK_LABEL;
  }

  return formatDurationMinutes(Math.round((end - start) / 60000));
}

function firstName(fullName) {
  return String(fullName ?? "").trim().split(/\s+/)[0] || "";
}

// The link is only ever a path on our own site. Anything that resolves off the
// configured origin or to a non-web scheme (a "//host" or "javascript:" path in
// a payload) yields no link at all.
function safeUrl(path, appUrl) {
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

function displayUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`;
  } catch {
    return "";
  }
}

function addressParts(payload) {
  return [payload.address_line_1, payload.address_line_2, payload.city, payload.postcode]
    .filter(Boolean);
}

function addOnsList(payload) {
  const addOns = Array.isArray(payload.selected_add_ons) ? payload.selected_add_ons : [];
  return addOns.map((addOn) => addOn.name).filter(Boolean).join(", ");
}

function money(value) {
  return formatMoneyFromPence(value);
}

function pence(value) {
  const amount = Number(value);
  return Number.isInteger(amount) ? amount : 0;
}

// The three refund states the templates draw, plus the settled state the app
// actually reaches once Stripe confirms. Tone names index COLORS in the layout.
function refundStatus(payload, { isProvider }) {
  const refunded = pence(payload.refund_amount_pence);

  if (refunded <= 0) {
    return {
      kind: "status",
      tone: "ok",
      title: "Settled — no refund due",
      detail: isProvider
        ? `Nothing goes back to the card. The ${money(payload.retained_amount_pence)} is already in your Stripe balance.`
        : "Nothing is going back to your card under the cancellation policy.",
    };
  }

  if (payload.refund_status === "refund_failed") {
    return {
      kind: "status",
      tone: "bad",
      title: "The first refund attempt failed. Ceaute is retrying it.",
      detail:
        "Nothing is needed from you. The retry runs automatically and support is alerted if it fails again.",
    };
  }

  if (payload.refund_status === "refunded") {
    return {
      kind: "status",
      tone: "ok",
      title: "Refund settled",
      detail: "It has left Stripe and is on its way to the card the booking was paid with.",
    };
  }

  return {
    kind: "status",
    tone: "pending",
    title: "Refund processing with Stripe",
    detail:
      pence(payload.retained_amount_pence) > 0
        ? "Usually 5 to 10 working days to reach the card the booking was paid with."
        : "Usually 5 to 10 working days to reach the card the booking was paid with. Nothing was retained.",
  };
}

function facts(payload, appUrl, isProvider) {
  const addressLines = addressParts(payload);
  const addOns = addOnsList(payload);
  const bookingPath = isProvider
    ? payload.booking_id
      ? `/dashboard/bookings/${encodeURIComponent(payload.booking_id)}`
      : ""
    : payload.customer_booking_path;
  const bookingUrl = safeUrl(bookingPath, appUrl);

  return {
    providerName: payload.provider_name || BOOKING_FALLBACK_LABEL,
    customerFullName: payload.customer_name || BOOKING_FALLBACK_LABEL,
    customerFirstName: firstName(payload.customer_name) || BOOKING_FALLBACK_LABEL,
    customerEmail: payload.customer_email || "",
    customerPhone: payload.customer_phone || "",
    treatmentName: payload.treatment_name || BOOKING_FALLBACK_LABEL,
    addOns,
    treatmentLine: `${payload.treatment_name || BOOKING_FALLBACK_LABEL}${addOns ? ` with ${addOns}` : ""}.`,
    weekday: formatWeekday(payload.start_at),
    dayLong: formatDayLong(payload.start_at),
    dayShort: formatDayShort(payload.start_at),
    dateShort: formatDateShort(payload.start_at),
    startTime: formatTime(payload.start_at),
    endTime: formatTime(payload.end_at),
    duration: durationLabel(payload.start_at, payload.end_at),
    amountPaid: money(payload.amount_paid_pence),
    amountDue: money(payload.amount_due_later_pence),
    totalPrice: money(pence(payload.amount_paid_pence) + pence(payload.amount_due_later_pence)),
    refundAmount: money(payload.refund_amount_pence),
    retainedAmount: money(payload.retained_amount_pence),
    retainedPence: pence(payload.retained_amount_pence),
    refundedPence: pence(payload.refund_amount_pence),
    deadlineLong: formatSingleDateTime(payload.cancellation_deadline_at),
    cancelledAtLong: formatSingleDateTime(payload.cancelled_at),
    addressSingle: addressLines.length ? addressLines.join(", ") : BOOKING_FALLBACK_LABEL,
    accessInstructions: payload.access_instructions || "",
    hasAddress: addressLines.length > 0,
    directionsUrl: addressLines.length
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressLines.join(", "))}`
      : "",
    bookingUrl,
    bookingUrlDisplay: displayUrl(bookingUrl),
    dashboardBookingsUrl: safeUrl("/dashboard/bookings", appUrl),
    providerUrl: payload.provider_username
      ? safeUrl(`/@${encodeURIComponent(payload.provider_username)}`, appUrl)
      : "",
    discoverUrl: safeUrl("/discover", appUrl),
  };
}

const RULE = { kind: "rule", margin: "26px 0 20px" };
const RULE_TIGHT = { kind: "rule", margin: "24px 0 20px" };

function confirmedCustomer(f) {
  return {
    preheader: `${f.dayShort} at ${f.startTime} with ${f.providerName}. Address and what is due inside.`,
    blocks: [
      { kind: "headline", text: `${f.customerFirstName}, you’re booked with ${f.providerName}.` },
      { kind: "when", dayLong: f.dayLong, startTime: f.startTime, endTime: f.endTime, duration: f.duration },
      { kind: "rule", margin: "22px 0 0" },
      { kind: "line", text: f.treatmentLine },
      { kind: "rule", margin: "22px 0 22px" },
      { kind: "address", single: f.addressSingle, access: f.accessInstructions },
      {
        kind: "actions",
        items: [
          { label: "Directions", url: f.directionsUrl, variant: "primary" },
          { label: "View booking", url: f.bookingUrl, variant: "secondary" },
        ],
      },
      RULE,
      {
        kind: "money",
        strong: `${f.amountPaid} paid. ${f.amountDue} due on the day.`,
        muted: `Free cancellation until ${f.deadlineLong}.`,
      },
    ],
  };
}

function confirmedProvider(f) {
  return {
    preheader: `${f.customerFirstName} booked ${f.treatmentName} for ${f.dayShort} at ${f.startTime}.`,
    blocks: [
      {
        kind: "headline",
        text: `${f.customerFirstName} booked ${f.treatmentName} for ${f.weekday} at ${f.startTime}.`,
      },
      { kind: "when", dayLong: f.dayLong, startTime: f.startTime, endTime: f.endTime, duration: f.duration },
      { kind: "rule", margin: "22px 0 0" },
      { kind: "line", text: f.treatmentLine },
      { kind: "rule", margin: "22px 0 22px" },
      // B4: no address here — she knows her own street. The space goes to the
      // customer's name and number, which is what she actually needs.
      {
        kind: "contact",
        name: f.customerFullName,
        phone: f.customerPhone,
        phoneE164: f.customerPhone,
        email: f.customerEmail,
      },
      {
        kind: "actions",
        items: [
          { label: "Open booking", url: f.bookingUrl, variant: "primary" },
          { label: "Your diary", url: f.dashboardBookingsUrl, variant: "secondary" },
        ],
      },
      RULE,
      {
        kind: "money",
        strong: `${f.amountPaid} is in your Stripe. Collect ${f.amountDue} on the day.`,
        muted: `They can cancel free until ${f.deadlineLong}.`,
      },
    ],
  };
}

function customerCancelledCustomer(f, payload) {
  const retained = f.retainedPence > 0;
  const headline = retained
    ? `${f.providerName} keeps ${f.retainedAmount} of your ${f.amountPaid}.`
    : `Your ${f.refundAmount} is on its way back to your card.`;

  return {
    preheader: retained
      ? `${f.providerName} keeps ${f.retainedAmount} of your ${f.amountPaid}.`
      : `Your ${f.refundAmount} is on its way back to your card.`,
    blocks: [
      { kind: "headline", text: headline },
      {
        kind: "lede",
        text: `${f.dayLong} at ${f.startTime} with ${f.providerName} is cancelled, and the time is free for someone else.`,
      },
      RULE,
      refundStatus(payload, { isProvider: false }),
      RULE_TIGHT,
      {
        kind: "meta",
        text: `Cancelled by you on ${f.cancelledAtLong}. ${f.treatmentName}, ${f.totalPrice} total, ${f.amountPaid} of it paid online.`,
      },
      {
        kind: "actions",
        items: [
          { label: `Book ${f.providerName} again`, url: f.providerUrl, variant: "secondary" },
        ],
      },
    ],
  };
}

function providerCancelledCustomer(f, payload) {
  return {
    preheader: `${f.providerName} cancelled your ${f.weekday} appointment. Full refund on its way.`,
    blocks: [
      { kind: "headline", text: `${f.providerName} cancelled your ${f.weekday} appointment.` },
      {
        kind: "lede",
        text: `${f.treatmentName} on ${f.dateShort} at ${f.startTime} is off, and your full ${f.refundAmount} is being refunded — a provider cancellation never keeps anything.`,
      },
      RULE,
      refundStatus(payload, { isProvider: false }),
      RULE_TIGHT,
      // B5: the way forward leads, because this is the one cancellation Ceaute
      // caused. The template's "three others are free" sentence is not here:
      // it needs an availability query across providers that does not exist.
      {
        kind: "actions",
        items: [
          { label: "Find another time", url: f.discoverUrl, variant: "primary" },
          { label: "View booking", url: f.bookingUrl, variant: "secondary" },
        ],
      },
    ],
  };
}

function customerCancelledProvider(f, payload) {
  const retained = f.retainedPence > 0;
  const refunded = f.refundedPence > 0;
  const headline = retained
    ? `${f.customerFirstName} cancelled ${f.weekday}. You keep the ${f.retainedAmount}.`
    : `${f.customerFirstName} cancelled ${f.weekday}.`;
  const lede = retained
    ? refunded
      ? `They cancelled after the deadline, so ${f.retainedAmount} stays with you and ${f.refundAmount} goes back. ${f.weekday} ${f.startTime} to ${f.endTime} is open on your page again.`
      : `They cancelled after the deadline, so the deposit stays with you and nothing is refunded. ${f.weekday} ${f.startTime} to ${f.endTime} is open on your page again.`
    : `They cancelled before the deadline, so ${f.refundAmount} goes back to their card. ${f.weekday} ${f.startTime} to ${f.endTime} is open on your page again.`;

  return {
    preheader: headline,
    blocks: [
      { kind: "headline", text: headline },
      { kind: "lede", text: lede },
      RULE,
      refundStatus(payload, { isProvider: true }),
      RULE_TIGHT,
      {
        kind: "meta",
        text: `${f.customerFullName}, ${f.customerPhone || BOOKING_FALLBACK_LABEL} · ${f.treatmentName}, cancelled ${f.cancelledAtLong}.`,
      },
      {
        kind: "actions",
        items: [{ label: "Your diary", url: f.dashboardBookingsUrl, variant: "secondary" }],
      },
    ],
  };
}

function providerCancelledProvider(f, payload) {
  return {
    preheader: `You cancelled ${f.weekday} with ${f.customerFirstName}.`,
    blocks: [
      { kind: "headline", text: `You cancelled ${f.weekday} with ${f.customerFirstName}.` },
      {
        kind: "lede",
        text: `${f.treatmentName} on ${f.dateShort} at ${f.startTime} is cancelled. ${f.customerFirstName} has been emailed and ${f.refundAmount} is being returned to their card in full.`,
      },
      RULE,
      {
        ...refundStatus(payload, { isProvider: true }),
        detail: "A provider cancellation always refunds in full, whatever the timing. Nothing is retained.",
      },
      RULE_TIGHT,
      {
        kind: "meta",
        text: `${f.customerFullName}, ${f.customerPhone || BOOKING_FALLBACK_LABEL} · ${f.treatmentName}, cancelled ${f.cancelledAtLong}. ${f.weekday} ${f.startTime} to ${f.endTime} is open on your page again.`,
      },
      {
        kind: "actions",
        items: [{ label: "Your diary", url: f.dashboardBookingsUrl, variant: "secondary" }],
      },
    ],
  };
}

const BUILDERS = {
  booking_confirmed_customer: confirmedCustomer,
  booking_confirmed_provider: confirmedProvider,
  customer_cancelled_customer: customerCancelledCustomer,
  customer_cancelled_provider: customerCancelledProvider,
  provider_cancelled_customer: providerCancelledCustomer,
  provider_cancelled_provider: providerCancelledProvider,
};

// One structured description of the email. The text and HTML renderers both
// read these blocks, so a booking fact cannot appear in one alternative and not
// the other.
export function buildBookingEmailContent(email, appUrl) {
  const payload = email.payload ?? {};
  const isProvider = email.recipient_role === "provider";
  const subject = bookingEmailSubject(email);
  const f = facts(payload, appUrl, isProvider);
  const build = BUILDERS[email.event_type];

  if (!build) {
    return {
      subject,
      preheader: subject,
      blocks: [{ kind: "headline", text: subject }],
      footerUrl: f.bookingUrl,
      footerUrlDisplay: f.bookingUrlDisplay,
    };
  }

  const { preheader, blocks } = build(f, payload);

  return {
    subject,
    preheader,
    blocks: blocks.filter(Boolean),
    footerUrl: f.bookingUrl,
    footerUrlDisplay: f.bookingUrlDisplay,
  };
}

// The plain-text projection of the same blocks, in the order the README fixes:
// headline, date and time, treatment, address (confirmations only), money,
// deadline, link.
function blockToTextLines(block) {
  switch (block.kind) {
    case "headline":
    case "lede":
    case "line":
    case "meta":
      return [block.text];
    case "when":
      // Two lines, matching the two blocks the HTML draws, so each text line is
      // a literal substring of the rendered email's visible text.
      return [block.dayLong, `${block.startTime} until ${block.endTime} · ${block.duration}`];
    case "address":
      return [block.single, block.access].filter(Boolean);
    case "contact":
      return [block.name, [block.phone, block.email].filter(Boolean).join(" · ")].filter(Boolean);
    case "status":
      return [`${block.title} ${block.detail}`];
    case "money":
      return [block.strong, block.muted].filter(Boolean);
    case "actions":
      return block.items
        .filter((item) => item.url && item.label)
        .map((item) => `${item.label}: ${item.url}`);
    default:
      return [];
  }
}

export function renderBookingEmailText(email, appUrl) {
  const content = buildBookingEmailContent(email, appUrl);
  const body = content.blocks.flatMap(blockToTextLines);

  return [content.subject, "", ...body].join("\n");
}

export function renderBookingEmailHtml(email, appUrl) {
  const content = buildBookingEmailContent(email, appUrl);

  return renderEmailShell({
    title: content.subject,
    preheader: content.preheader,
    blocks: content.blocks,
    footerUrl: content.footerUrl,
    footerUrlDisplay: content.footerUrlDisplay,
  });
}
