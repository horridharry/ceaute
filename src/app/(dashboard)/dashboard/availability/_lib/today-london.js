// Today's local date in Europe/London, used by both the availability reads
// (to only list upcoming blocked dates) and the availability mutations (to
// reject blocking a date in the past).

export function todayInLondon() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return `${getPart("year")}-${getPart("month")}-${getPart("day")}`;
}
