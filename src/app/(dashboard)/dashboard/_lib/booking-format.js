// London times and dates for the provider's booking rows ("2:30 pm",
// "Wed 23 Sept"), matching the 12-hour times used everywhere else.
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
  timeZone: "Europe/London",
});

const shortDateFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/London",
});

function valid(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatClockTime(value) {
  const date = valid(value);
  return date ? timeFormat.format(date).replace(/\s?([ap])\.?m\.?$/i, " $1m").toLowerCase() : "";
}

export function formatTimeRange(startAt, endAt) {
  const start = formatClockTime(startAt);
  const end = formatClockTime(endAt);
  return start && end ? `${start} – ${end}` : start;
}

export function formatShortDate(value) {
  const date = valid(value);
  return date ? shortDateFormat.format(date).replace(",", "") : "";
}

const pluralise = (count, word) => `${count} ${word}${count === 1 ? "" : "s"}`;

// "BIAB overlay · 1 add-on"
export function treatmentLine(booking) {
  const addOns = booking.selected_add_ons?.length ?? 0;
  return addOns ? `${booking.treatment_name} · ${pluralise(addOns, "add-on")}` : booking.treatment_name;
}

export function inspirationLine(count) {
  return count ? pluralise(count, "inspiration photo") : "";
}
