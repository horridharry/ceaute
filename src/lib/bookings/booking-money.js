// What a booking costs and what happens to the money if it is cancelled, in
// the words every customer screen and email uses.
//
// Nothing here calculates a percentage. Before a hold exists the numbers come
// from PostgreSQL's quote (ceaute.get_public_booking_terms); afterwards from
// the booking's own snapshot, which PostgreSQL wrote when the hold was made.
// A snapshot from before percentage terms keeps the rule it was made under:
// a blank retained amount keeps £0, which is what the database refunds.
import { snapshotAmountDueNowPence } from "@/lib/payments/booking-payments";

const TIME_ZONE = "Europe/London";

function pence(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0;
}

export function formatPounds(value) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence(value) / 100);
}

// "Wed 30 Sept, 10:00 am" in London time.
export function formatDeadline(startAt, windowHours) {
  const start = new Date(startAt);

  if (Number.isNaN(start.getTime())) {
    return "";
  }

  const deadline = new Date(start.getTime() - Number(windowHours) * 60 * 60_000);
  const date = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: TIME_ZONE,
  }).format(deadline);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
    timeZone: TIME_ZONE,
  }).format(deadline);

  return `${date}, ${time}`;
}

function describe({ totalPence, dueNowPence, lateKeepPence, mode, percent, windowHours, legacy }) {
  const total = pence(totalPence);
  const dueNow = Math.min(pence(dueNowPence), total);
  const keep = Math.min(pence(lateKeepPence), dueNow);
  const isDeposit = mode === "deposit" || mode === "fixed_deposit";

  return {
    totalPence: total,
    dueNowPence: dueNow,
    dueLaterPence: total - dueNow,
    lateKeepPence: keep,
    lateRefundPence: dueNow - keep,
    isDeposit,
    percent: Number.isInteger(percent) ? percent : null,
    windowHours: Number(windowHours) || 24,
    legacy,
    // The £1 minimum raised the deposit above the percentage.
    minimumApplied: isDeposit && !legacy && dueNow > keep && keep > 0,
  };
}

// Review, before any hold: the quote PostgreSQL computed for this price.
export function termsFromQuote(quote, totalPricePence) {
  if (!quote?.accepts_new_bookings || quote.amount_due_now_pence === null || quote.amount_due_now_pence === undefined) {
    return null;
  }

  return describe({
    totalPence: totalPricePence,
    dueNowPence: quote.amount_due_now_pence,
    lateKeepPence: quote.late_cancellation_retained_pence,
    mode: quote.payment_mode,
    percent: Number(quote.deposit_percent),
    windowHours: quote.cancellation_window_hours,
    legacy: false,
  });
}

// A held or confirmed booking: its snapshot, and what was actually paid when
// that is known.
export function termsFromSnapshot(snapshot = {}, { amountPaidPence = null } = {}) {
  const dueNow = amountPaidPence === null || amountPaidPence === undefined
    ? snapshotAmountDueNowPence(snapshot)
    : pence(amountPaidPence);
  const commitment = snapshot?.commitment_amount_pence;
  const legacy = snapshot?.deposit_percent === undefined || snapshot?.deposit_percent === null;

  return describe({
    totalPence: snapshot?.total_price_pence,
    dueNowPence: dueNow,
    // A blank retained amount (possible only before percentage terms) keeps
    // £0: prepare_booking_cancellation treats it as zero.
    lateKeepPence: commitment === null || commitment === undefined || commitment === "" ? 0 : commitment,
    mode: snapshot?.payment_mode,
    percent: Number(snapshot?.deposit_percent),
    windowHours: snapshot?.cancellation_window_hours ?? 24,
    legacy,
  });
}

export function payNowLabel(terms) {
  if (!terms.isDeposit) {
    return "Pay now";
  }

  return terms.percent ? `Deposit to pay now (${terms.percent}%)` : "Deposit to pay now";
}

// The sentence after "After that," for a late customer cancellation.
export function lateCancellationSentence(terms, providerName) {
  const name = providerName || "The provider";

  if (terms.lateKeepPence === 0) {
    return "you still get back everything you paid.";
  }

  if (terms.lateRefundPence === 0) {
    return terms.isDeposit
      ? `${name} keeps your ${formatPounds(terms.lateKeepPence)} deposit.`
      : `${name} keeps the full ${formatPounds(terms.lateKeepPence)}.`;
  }

  const kept = terms.percent && !terms.isDeposit
    ? `${terms.percent}% (${formatPounds(terms.lateKeepPence)})`
    : formatPounds(terms.lateKeepPence);

  return `${name} keeps ${kept} and refunds ${formatPounds(terms.lateRefundPence)}.`;
}

// The Payment block, as text.
export function paymentView(terms) {
  return {
    payNowLabel: payNowLabel(terms),
    dueNow: formatPounds(terms.dueNowPence),
    dueLater: terms.dueLaterPence > 0 ? formatPounds(terms.dueLaterPence) : null,
    minimumApplied: terms.minimumApplied,
  };
}

// The Cancellation block, as text.
export function cancellationView(terms, { startAt, providerName, policy = "" }) {
  return {
    deadline: formatDeadline(startAt, terms.windowHours),
    windowHours: terms.windowHours,
    summary: lateCancellationSentence(terms, providerName),
    policy: String(policy ?? "").trim() || null,
  };
}

// The price lines of a held or confirmed booking. The snapshot keeps the
// total and each add-on's price; the treatment's own price is the rest.
export function snapshotPriceLines(snapshot = {}) {
  const addOns = Array.isArray(snapshot?.selected_add_ons) ? snapshot.selected_add_ons : [];
  const addOnTotal = addOns.reduce((total, addOn) => total + pence(addOn?.additional_price_pence), 0);

  return [
    {
      key: "treatment",
      label: snapshot?.treatment_name ?? "Treatment",
      price: formatPounds(pence(snapshot?.total_price_pence) - addOnTotal),
      addOn: false,
    },
    ...addOns.map((addOn, index) => ({
      key: `add-on-${addOn?.id ?? index}`,
      label: addOn?.name ?? "Add-on",
      price: formatPounds(addOn?.additional_price_pence),
      addOn: true,
    })),
  ];
}

// What cancelling now would do, for the confirmation dialog: everything back
// before the deadline; after it, the provider keeps their share of what was
// paid. PostgreSQL decides the actual refund when the booking is cancelled.
export function cancellationPreview(terms, { startAt, providerName, now = Date.now() }) {
  const name = providerName || "The provider";
  const deadline = new Date(startAt).getTime() - terms.windowHours * 60 * 60_000;
  const late = Number.isFinite(deadline) && now >= deadline;
  const paid = terms.dueNowPence;
  const keep = late ? terms.lateKeepPence : 0;
  const refund = paid - keep;
  const lateReason = `It’s less than ${terms.windowHours} hours before your appointment, so`;
  let description;

  if (paid <= 0) {
    description = "Nothing was paid online, so there’s nothing to refund.";
  } else if (keep <= 0) {
    description = `You’ll get back ${formatPounds(paid)}, everything you paid online.`;
  } else if (refund > 0) {
    description = `${lateReason} ${name} keeps ${formatPounds(keep)}. You’ll get back ${formatPounds(refund)}.`;
  } else {
    description = `${lateReason} ${name} keeps the ${formatPounds(keep)} you paid. There’s no refund.`;
  }

  return {
    late,
    refundPence: refund,
    keepPence: keep,
    description,
    confirmLabel: refund > 0 ? `Cancel and refund ${formatPounds(refund)}` : "Cancel booking",
  };
}
