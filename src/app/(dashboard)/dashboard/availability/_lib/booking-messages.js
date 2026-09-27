// Wording for the bookings and payments in progress on a date the provider
// has opened. Counts are read once when the page loads and are advisory only:
// they never stop a date being removed or its times changed, and
// create_validated_booking_hold and complete_booking_payment_attempt decide
// what can actually be booked.

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

// "2 bookings", "1 payment in progress", "2 bookings and 1 payment in
// progress", or "" when there is nothing.
function formatBookingsCount({ confirmed, inProgress }) {
  const bookings = `${confirmed} ${bookingsWord(confirmed)}`;
  const payments = `${inProgress} ${inProgress === 1 ? "payment" : "payments"} in progress`;

  if (confirmed > 0 && inProgress > 0) {
    return `${bookings} and ${payments}`;
  }

  if (confirmed > 0) {
    return bookings;
  }

  if (inProgress > 0) {
    return payments;
  }

  return "";
}

// The muted line under a date, or "" when the date has nothing on it.
export function formatDateBookingsLine(counts) {
  const confirmed = toCount(counts?.confirmed);
  const inProgress = toCount(counts?.inProgress);
  const line = formatBookingsCount({ confirmed, inProgress });

  return confirmed > 0 ? `${line} on this day` : line;
}

// The muted line on a drop's card: its dates' bookings and payments in
// progress added up, or "" when none of its dates has any.
export function formatDropBookingsLine(dates, countsByDate) {
  let confirmed = 0;
  let inProgress = 0;

  for (const date of dates ?? []) {
    const counts = countsByDate?.[date.local_date];
    confirmed += toCount(counts?.confirmed);
    inProgress += toCount(counts?.inProgress);
  }

  return formatBookingsCount({ confirmed, inProgress });
}
