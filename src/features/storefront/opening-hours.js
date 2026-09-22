import { formatClockRange } from "@/lib/time/clock-time";

// The provider's normal weekly hours, for the storefront's Availability
// section: the days they are open, Monday first, with the times they set.
// Closed days are left out entirely rather than listed as "Closed", and
// blocked dates and holidays never appear here - the booking journey stays
// the only source of times a customer can actually book.

// Weekday numbers follow PostgreSQL and the provider's Availability screen:
// Sunday is 0. The page reads Monday to Sunday.
const WEEKDAY_NAMES = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export function weekdayName(weekday) {
  return WEEKDAY_NAMES[weekday] ?? null;
}

export function openingHours(rules) {
  return (rules ?? [])
    .filter((rule) => weekdayName(rule?.weekday) && rule.starts_at && rule.ends_at)
    .map((rule) => ({
      weekday: rule.weekday,
      day: weekdayName(rule.weekday),
      hours: formatClockRange(rule.starts_at, rule.ends_at),
    }))
    .sort((a, b) => WEEK_ORDER.indexOf(a.weekday) - WEEK_ORDER.indexOf(b.weekday));
}
