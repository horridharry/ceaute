// Wording for bookings and payments in progress on a date the provider is
// blocking or has blocked. Counts are read once when the page loads and are
// advisory only: create_validated_booking_hold and
// complete_booking_payment_attempt decide what can actually be booked.

const toCount = (value) => {
  const count = Number(value);

  return Number.isFinite(count) && count > 0 ? count : 0;
};

const bookingsWord = (count) => (count === 1 ? "booking" : "bookings");

// Rows from ceaute.get_provider_booking_counts_by_local_date, keyed by date:
// { "2026-10-18": { confirmed: 2, inProgress: 1 } }.
export function toBookingCountsByDate(rows) {
  return Object.fromEntries(
    (rows ?? []).map((row) => [
      String(row.local_date).slice(0, 10),
      {
        confirmed: toCount(row.confirmed_count),
        inProgress: toCount(row.in_progress_count),
      },
    ]),
  );
}

// Shown under the date input while blocking. When no date is chosen yet the
// caller shows nothing and doesn't call this; an empty label returns "" too.
export function formatBookingsOnDateMessage(counts, dateLabel) {
  if (!dateLabel) {
    return "";
  }

  const confirmed = toCount(counts?.confirmed);
  const inProgress = toCount(counts?.inProgress);

  if (confirmed === 0 && inProgress === 0) {
    return "No bookings on this date.";
  }

  if (inProgress === 0) {
    return `You have ${confirmed} ${bookingsWord(confirmed)} on ${dateLabel}. ${
      confirmed === 1 ? "It'll" : "They'll"
    } stay booked. Blocking only stops new ones.`;
  }

  if (confirmed === 0) {
    const single = inProgress === 1;

    return `${inProgress} ${bookingsWord(inProgress)} ${
      single ? "is" : "are"
    } being paid for on ${dateLabel} right now. If payment finishes, ${
      single ? "it" : "they"
    } will be booked. Blocking only stops new ones.`;
  }

  return `You have ${confirmed} ${bookingsWord(confirmed)} on ${dateLabel}, and ${inProgress} more ${
    inProgress === 1 ? "is" : "are"
  } being paid for right now. Existing bookings stay, and payments already started can still finish. Blocking only stops new ones.`;
}

// The line under a blocked-date row, or "" when the date has nothing on it.
export function formatBlockedDateBookingsLine(counts) {
  const confirmed = toCount(counts?.confirmed);
  const inProgress = toCount(counts?.inProgress);
  const bookings = `${confirmed} ${bookingsWord(confirmed)}`;
  const payments = `${inProgress} ${inProgress === 1 ? "payment" : "payments"} in progress`;

  if (confirmed > 0 && inProgress > 0) {
    return `${bookings} and ${payments} on this day`;
  }

  if (confirmed > 0) {
    return `${bookings} on this day`;
  }

  if (inProgress > 0) {
    return payments;
  }

  return "";
}
