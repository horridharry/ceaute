export function hasPublicUsernamePrefix(username) {
  return decodeURIComponent(String(username ?? "")).trim().startsWith("@");
}

export function normalizePublicUsername(username) {
  return decodeURIComponent(String(username ?? ""))
    .trim()
    .replace(/^@/, "")
    .toLowerCase();
}

export function formatPricePence(pricePence) {
  return Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pricePence ?? 0) / 100);
}

// Durations read the way a provider says them — `2h 15m`, not `2 hr 15 min`
// (06-copy-deck.md, "Voice"). This is the public booking journey's formatter;
// booking summaries have their own in src/lib/bookings/booking-display.js.
export function formatDurationMinutes(durationMinutes) {
  const minutes = Number(durationMinutes ?? 0);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours && remainingMinutes) {
    return `${hours}h ${remainingMinutes}m`;
  }

  if (hours) {
    return `${hours}h`;
  }

  return `${remainingMinutes}m`;
}

export function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatTimeLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h12",
  })
    .format(date)
    .toLowerCase();
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes ?? 0) * 60_000);
}

// A provider page with no visible reviews yet should not advertise that fact;
// the whole section, heading included, is omitted rather than shown empty.
export function shouldShowReviewsSection(reviews) {
  return Array.isArray(reviews) && reviews.length > 0;
}
