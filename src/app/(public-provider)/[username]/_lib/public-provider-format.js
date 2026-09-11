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

export function formatDurationMinutes(durationMinutes) {
  const minutes = Number(durationMinutes ?? 0);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours && remainingMinutes) {
    return `${hours} hr ${remainingMinutes} min`;
  }

  if (hours) {
    return `${hours} hr`;
  }

  return `${remainingMinutes} min`;
}

export function formatDateLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "short",
  }).format(date);
}

export function formatTimeLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
    .format(date)
    .toLowerCase();
}

export function addMinutes(date, minutes) {
  return new Date(date.getTime() + Number(minutes ?? 0) * 60_000);
}
