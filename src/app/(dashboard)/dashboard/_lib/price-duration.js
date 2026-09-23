export function minutesToDuration(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;

  return `00:${String(hours).padStart(2, "0")}:${String(remainingMinutes).padStart(2, "0")}`;
}

export function durationToMinutes(value) {
  const minutes = Number(value);

  if (Number.isInteger(minutes)) {
    return minutes;
  }

  if (typeof value !== "string") {
    return 0;
  }

  const parts = value.split(":").map((part) => Number(part));
  if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) {
    return 0;
  }

  return parts[1] * 60 + parts[2];
}

// Pounds entered as "12" or "12.50" become whole pence. Returns null when the
// text is not a price at all, which callers report as a validation error.
export function nonNegativePriceToPence(value) {
  const normalizedValue = String(value ?? "").trim();

  if (!/^\d+(\.\d{1,2})?$/.test(normalizedValue)) {
    return null;
  }

  const [pounds, pence = ""] = normalizedValue.split(".");
  const pricePence =
    Number(pounds) * 100 + Number(pence.padEnd(2, "0").slice(0, 2));

  return Number.isInteger(pricePence) && pricePence >= 0 ? pricePence : null;
}

export function penceToPrice(value) {
  const pence = Number(value);
  return Number.isFinite(pence) ? pence / 100 : 0;
}

export function minutesToDurationParts(minutes) {
  const safeMinutes = Number.isFinite(Number(minutes)) ? Number(minutes) : 0;

  return {
    hours: Math.floor(safeMinutes / 60),
    minutes: safeMinutes % 60,
  };
}

export function formatDurationMinutes(minutes) {
  const { hours, minutes: remainingMinutes } = minutesToDurationParts(minutes);

  return [hours ? `${hours} hours` : "", remainingMinutes ? `${remainingMinutes} minutes` : ""]
    .filter(Boolean)
    .join(" ");
}

const poundsFormat = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  minimumFractionDigits: 2,
});

// "£45.00": the dashboard's list-row price.
export function formatPrice(pence) {
  return poundsFormat.format(penceToPrice(pence));
}

// "1 h 15 min", "45 min", "2 h": the dashboard's list-row duration.
export function formatShortDuration(minutes) {
  const { hours, minutes: remainingMinutes } = minutesToDurationParts(minutes);

  return [hours ? `${hours} h` : "", remainingMinutes ? `${remainingMinutes} min` : ""]
    .filter(Boolean)
    .join(" ") || "0 min";
}
