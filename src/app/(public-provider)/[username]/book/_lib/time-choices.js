// "When suits you?" (approved 23 September 2026): the day strip and the times
// for the chosen day, grouped by part of the day. Pure, so the server page and
// the client picker share it and it can be tested without a browser.

import { opensSentence } from "@/lib/availability/drops";

const TIME_ZONE = "Europe/London";

function dateFromLocal(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

const shortWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: TIME_ZONE });
const longWeekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: TIME_ZONE });
const monthName = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: TIME_ZONE });
const shortMonth = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: TIME_ZONE });

export const PARTS_OF_DAY = Object.freeze(["Morning", "Afternoon", "Evening"]);

// London clock time "HH:MM" to its part of the day: before noon, noon to
// 5 pm, and from 5 pm.
export function partOfDay(localTime) {
  const hour = Number(String(localTime).slice(0, 2));

  if (hour < 12) return "Morning";
  if (hour < 17) return "Afternoon";
  return "Evening";
}

// 24-hour times with two-digit hours, the usual UK form (approved
// 23 September 2026): "09:15", "12:00", "17:30".
export function formatSlotTime(localTime) {
  const [hourText = "", minute = "00"] = String(localTime).split(":");

  return `${hourText.padStart(2, "0")}:${minute.slice(0, 2)}`;
}

export function groupSlotsByPartOfDay(slots) {
  return PARTS_OF_DAY.map((part) => ({
    part,
    slots: slots.filter((slot) => partOfDay(slot.local_time) === part),
  })).filter((group) => group.slots.length > 0);
}

// The strip holds only the dates the provider has opened, and starts at the
// first one that is not entirely inside the 24 hours' notice, so today (never
// bookable) does not lead it. When every open date is inside the notice they
// all stay, each saying "No times", so the screen never claims nothing is
// open while the storefront says a month is open for booking.
export function buildDayStrip(availableDates) {
  const firstUseful = availableDates.findIndex((date) => date.unavailable_reason !== "notice");
  const dates = firstUseful === -1 ? availableDates : availableDates.slice(firstUseful);

  return dates.map((date) => {
    const when = dateFromLocal(date.local_date);
    const month = monthName.format(when);
    const status = date.slots.length > 0 ? "available" : date.unavailable_reason ?? "full";
    const fullDate = `${longWeekday.format(when)} ${when.getUTCDate()} ${month}`;
    const statusLabel =
      status === "full" ? ", fully booked" : status === "available" ? "" : ", no times";

    return {
      localDate: date.local_date,
      weekday: shortWeekday.format(when),
      weekdayLong: longWeekday.format(when),
      day: String(when.getUTCDate()),
      month,
      monthShort: shortMonth.format(when),
      fullDate,
      label: `${fullDate}${statusLabel}`,
      status,
      slots: date.slots,
    };
  });
}

export function firstAvailableIndex(days) {
  return days.findIndex((day) => day.status === "available");
}

export function nextAvailableIndex(days, fromIndex) {
  for (let index = fromIndex + 1; index < days.length; index += 1) {
    if (days[index].status === "available") {
      return index;
    }
  }

  return -1;
}

// The message a day without times shows, so a fully booked day and a day too
// short for this booking read differently.
export function unavailableDayMessage(day) {
  if (day.status === "full") {
    return `${day.fullDate} is fully booked.`;
  }

  if (day.status === "short") {
    return `There isn’t a long enough gap for this booking on ${day.fullDate}.`;
  }

  return `There are no times on ${day.fullDate}.`;
}

// The word under the date on a day card, so a fully booked day and a day
// without times read differently without relying on style. Available days say
// nothing.
export function dayStatusWord(day) {
  if (day.status === "available") return "";
  if (day.status === "full") return "Full";
  return "No times";
}

// The heading above the day cards: the month of the cards in view, or both
// months when the strip spans two ("September – October").
export function monthRangeLabel(days, firstIndex, lastIndex) {
  const first = days[Math.max(0, firstIndex)];
  const last = days[Math.min(days.length - 1, Math.max(firstIndex, lastIndex))];

  if (!first) return "";
  if (!last || last.month === first.month) return first.month;
  return `${first.month} – ${last.month}`;
}

// "Tue 6 Oct" for the Next available button.
export function shortDateLabel(day) {
  return `${day.weekday} ${day.day} ${day.monthShort}`;
}

// With no open date at all: when the next drop opens, if one is coming
// ("No dates are open. November slots open on 15 October at 7 pm."). Customers
// never read "drop".
export function nothingOpenMessage(nextDrop) {
  if (nextDrop) {
    return `No dates are open. ${opensSentence(nextDrop.name, nextDrop.opensAt)}.`;
  }

  return "No dates are open for booking right now.";
}

// Above a strip with no free start: when the next drop opens, with no full
// stop ("December slots open on 15 November at 7 pm"), or "" with none coming.
export function nextDropLine(nextDrop) {
  return nextDrop ? opensSentence(nextDrop.name, nextDrop.opensAt) : "";
}
