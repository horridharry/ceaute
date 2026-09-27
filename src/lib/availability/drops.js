import { formatClockTime } from "@/lib/time/clock-time";

// Ceaute names a drop by its dates, never by a name the provider types
// (docs/decisions/007-availability-released-in-drops.md, Words). This module
// is the one place that turns those dates into the words the provider and
// customers read: a month on its own ("October"), a range across dates
// ("1–14 November", "28 October – 10 November"), and when a drop opens
// ("15 October at 7 pm"). No React, no Supabase: dates in are 'YYYY-MM-DD'
// local dates and times are Europe/London.

const LONDON_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  timeZone: "Europe/London",
});
const LONDON_DAY_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  timeZone: "Europe/London",
});
const LONDON_YEAR_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "numeric",
  timeZone: "Europe/London",
});
const LONDON_TIME_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Europe/London",
});

// A 'YYYY-MM-DD' local date has no time of day to convert, so it is read as
// London noon: safely on the same London calendar date in either GMT or BST.
function londonDateFromLocalDate(localDate) {
  return new Date(`${localDate}T12:00:00Z`);
}

// The full English month name of a local date, e.g. 'November'. No year.
export function monthName(localDate) {
  return LONDON_MONTH_FORMATTER.format(londonDateFromLocalDate(localDate));
}

function dayOfMonth(localDate) {
  return Number(localDate.slice(8, 10));
}

// 'YYYY-MM' for a local date, used only to compare calendar months and years.
function yearMonthOf(localDate) {
  return LONDON_YEAR_MONTH_FORMATTER.format(londonDateFromLocalDate(localDate));
}

// The dates of a drop, read as the range a provider or customer sees:
// '1–14 November' (en dash, no spaces) within one month, or
// '28 October – 10 November' (spaced en dash) across months, or just
// '5 November' for a drop of one date. No year.
export function rangeName(firstDate, lastDate) {
  if (firstDate === lastDate) {
    return `${dayOfMonth(firstDate)} ${monthName(firstDate)}`;
  }

  if (yearMonthOf(firstDate) === yearMonthOf(lastDate)) {
    return `${dayOfMonth(firstDate)}–${dayOfMonth(lastDate)} ${monthName(lastDate)}`;
  }

  return `${dayOfMonth(firstDate)} ${monthName(firstDate)} – ${dayOfMonth(lastDate)} ${monthName(lastDate)}`;
}

// The provider Availability screen's name for one of the provider's drops.
// `sharesMonth` is true when another current drop of the same provider also
// has a date in firstDate/lastDate's calendar month, in which case the month
// name alone would not tell the two drops apart.
export function dropName({ firstDate, lastDate, sharesMonth }) {
  if (yearMonthOf(firstDate) === yearMonthOf(lastDate) && !sharesMonth) {
    return monthName(firstDate);
  }

  return rangeName(firstDate, lastDate);
}

// 'HH:MM' in Europe/London for an ISO string or Date.
function londonClockTime(opensAt) {
  const date = opensAt instanceof Date ? opensAt : new Date(opensAt);
  const parts = LONDON_TIME_FORMATTER.formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "";
  return `${hour}:${minute}`;
}

// When a drop opens, as a provider or customer reads it: '15 October at 7 pm'.
export function formatDropTime(opensAt) {
  const date = opensAt instanceof Date ? opensAt : new Date(opensAt);
  const dayMonth = LONDON_DAY_MONTH_FORMATTER.format(date);
  return `${dayMonth} at ${formatClockTime(londonClockTime(opensAt))}`;
}

// 'October slots open on 15 October at 7 pm' ("slots" in customer and
// provider copy, owner decision 27 September 2026).
export function opensSentence(name, opensAt) {
  return `${name} slots open on ${formatDropTime(opensAt)}`;
}

// The storefront's join of the drops open for booking:
// '<A> slots are open for booking', '<A> and <B> slots are open for booking',
// '<A>, <B> and <C> slots are open for booking'. An empty list gives ''.
export function openForBookingSentence(names) {
  const list = Array.isArray(names) ? names : [];

  if (list.length === 0) {
    return "";
  }

  if (list.length === 1) {
    return `${list[0]} slots are open for booking`;
  }

  const joined =
    list.length === 2
      ? list.join(" and ")
      : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;

  return `${joined} slots are open for booking`;
}

// Maps the rows of ceaute.get_public_availability_summary
// ({ drop_month, first_date, last_date, opens_at, is_open }) to the storefront
// Availability section's data: every open drop's name, and only the next
// upcoming drop's name and opening time. It never reads a shares_month field:
// the function does not return one.
export function summaryFromRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const open = [];
  let next = null;

  for (const row of list) {
    const name = row.drop_month
      ? monthName(row.drop_month)
      : rangeName(row.first_date, row.last_date);

    if (row.is_open) {
      open.push(name);
    } else if (!next) {
      next = { name, opensAt: row.opens_at };
    }
  }

  return { open, next };
}
