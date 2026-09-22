// One way of writing a time of day across Ceaute, so the hours a provider
// sets in Availability read the same on their public page:
// "09:00" → "9 am", "19:30" → "7:30 pm", "00:00" → "12 am".
export function formatClockTime(time) {
  const [hours, minutes] = String(time).split(":").map(Number);

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
    return "";
  }

  const period = hours < 12 ? "am" : "pm";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  if (minutes === 0) {
    return `${displayHours} ${period}`;
  }

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

// "9 am to 5 pm": the range a provider is open.
export function formatClockRange(startsAt, endsAt) {
  return `${formatClockTime(startsAt)} to ${formatClockTime(endsAt)}`;
}
