// The provider Availability screen's drop editor, as pure functions: how a
// date and a drop read, the editor's draft and baseline, and
// reading the submitted form for save_availability_drop
// (202609270001_availability_drops.sql). PostgreSQL checks every rule again;
// parseDropForm only gives the provider a readable message first.
import { isOnAppointmentGrid } from "@/lib/bookings/appointment-grid";
import { dropName, formatDropTime } from "@/lib/availability/drops";
import { formatClockRange, formatClockTime } from "@/lib/time/clock-time";

const LONDON = "Europe/London";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DEFAULT_HOURS = { hours_start: "09:00", hours_end: "17:00" };

export const TIMES_MESSAGE =
  "Choose 15-minute opening and closing times, with closing after opening.";
export const MISSING_TIMES_MESSAGE = "Add times for every date.";
export const LATER_INCOMPLETE_MESSAGE = "Choose a date and time for Later.";
export const DROP_TIME_PASSED_MESSAGE =
  "That time has passed. Choose a later drop time.";
export const SAVE_FAILED_MESSAGE = "Could not save availability.";

// A local date is read at 12:00 UTC so the calendar day is the same in
// Europe/London on both sides of a clock change.
const localDateToNoonUtc = (localDate) => {
  const [year, month, day] = localDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
};

function isValidLocalDate(value) {
  if (!DATE_PATTERN.test(String(value ?? ""))) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

const isQuarterHour = (value) =>
  TIME_PATTERN.test(String(value ?? "")) && isOnAppointmentGrid(value);

// 'HH:MM:SS' from PostgreSQL, or 'HH:MM', as 'HH:MM'.
export const toClockValue = (value) => String(value ?? "").slice(0, 5);

// "Friday 3 October", with the year added when it isn't today's year.
export function formatDateLabel(localDate, today) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LONDON,
  }).formatToParts(localDateToNoonUtc(localDate));
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const label = `${getPart("weekday")} ${getPart("day")} ${getPart("month")}`;
  const sameYear = localDate.slice(0, 4) === String(today ?? "").slice(0, 4);

  return sameYear ? label : `${label} ${getPart("year")}`;
}

// 'A', 'A and B', 'A, B and C'.
function joinList(items) {
  if (items.length <= 1) {
    return items.join("");
  }

  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function hasTimes(date) {
  return Array.isArray(date?.start_times)
    ? date.start_times.length > 0
    : Boolean(date?.hours_start && date?.hours_end);
}

// "10 am to 5 pm" for hours, "10 am, 12 pm and 3 pm" for start times, or ""
// for a date without times.
export function formatDateTimes(date) {
  if (Array.isArray(date?.start_times)) {
    return joinList(date.start_times.map(formatClockTime));
  }

  if (date?.hours_start && date?.hours_end) {
    return formatClockRange(date.hours_start, date.hours_end);
  }

  return "";
}

const datesWord = (count) => (count === 1 ? "date" : "dates");

// The times of a drop in one line, after its date count: "12 dates · 10 am
// to 5 pm" when every date has the same times, otherwise what kind of times
// they have: "hours vary by date", "start times vary by date", or
// "3 with hours, 2 with start times".
export function dropSummaryLine(drop) {
  const dates = Array.isArray(drop?.dates) ? drop.dates : [];
  const count = `${dates.length} ${datesWord(dates.length)}`;

  if (dates.length === 0) {
    return count;
  }

  const timesKey = (date) => {
    const { hours_start, hours_end, start_times } = normalizeDate(date);
    return JSON.stringify([hours_start, hours_end, start_times && [...start_times].sort()]);
  };
  const firstKey = timesKey(dates[0]);
  const withStartTimes = dates.filter(
    (date) => Array.isArray(date.start_times) && date.start_times.length > 0,
  ).length;
  const withHours = dates.filter(
    (date) => !Array.isArray(date.start_times) && date.hours_start && date.hours_end,
  ).length;
  let times;

  if (hasTimes(dates[0]) && dates.every((date) => timesKey(date) === firstKey)) {
    times = formatDateTimes(dates[0]);
  } else if (withHours === dates.length) {
    times = "hours vary by date";
  } else if (withStartTimes === dates.length) {
    times = "start times vary by date";
  } else {
    times = `${withHours} with hours, ${withStartTimes} with start times`;
  }

  return `${count} · ${times}`;
}

const toMillis = (value) =>
  value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);

export function isDropOpen(drop, now) {
  return toMillis(drop.opensAt) <= toMillis(now);
}

// 'Slots open for booking' or 'Slots open on 15 October at 7 pm'.
export function dropStatusLine(drop, now) {
  return isDropOpen(drop, now)
    ? "Slots open for booking"
    : `Slots open on ${formatDropTime(drop.opensAt)}`;
}

// Adds each drop's name. The month test is the one
// get_public_availability_summary uses: a drop whose dates all fall in one
// month is named by that month unless another current drop has a date in it.
export function namedDrops(drops) {
  const list = Array.isArray(drops) ? drops : [];

  return list.map((drop) => {
    const dates = drop.dates.map((date) => date.local_date).sort();
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    const month = firstDate.slice(0, 7);
    const sharesMonth = list.some(
      (other) =>
        other.id !== drop.id &&
        other.dates.some((date) => date.local_date.slice(0, 7) === month),
    );

    return {
      ...drop,
      firstDate,
      lastDate,
      name: dropName({ firstDate, lastDate, sharesMonth }),
    };
  });
}

// London wall-clock parts of an instant.
function londonParts(instant) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: LONDON,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const getPart = (type) => parts.find((part) => part.type === type)?.value;

  return {
    localDate: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
    localTime: `${getPart("hour")}:${getPart("minute")}`,
  };
}

// The instant of a London date and time, or null for a time the spring clock
// change skips.
export function londonInstant(localDate, localTime) {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offsetAt = (millis) => {
    const { localDate: date, localTime: time } = londonParts(new Date(millis));
    const [y, m, d] = date.split("-").map(Number);
    const [h, min] = time.split(":").map(Number);

    return Date.UTC(y, m - 1, d, h, min) - millis;
  };
  let millis = asUtc - offsetAt(asUtc);
  millis = asUtc - offsetAt(millis);

  const check = londonParts(new Date(millis));

  return check.localDate === localDate && check.localTime === localTime
    ? millis
    : null;
}

const normalizeDate = (date) =>
  Array.isArray(date.start_times)
    ? {
        local_date: date.local_date,
        hours_start: null,
        hours_end: null,
        start_times: date.start_times.map(toClockValue),
      }
    : {
        local_date: date.local_date,
        hours_start: date.hours_start ? toClockValue(date.hours_start) : null,
        hours_end: date.hours_end ? toClockValue(date.hours_end) : null,
        start_times: null,
      };

export const sortDates = (dates) =>
  [...dates].sort((a, b) => a.local_date.localeCompare(b.local_date));

// The editor's starting point. A new drop has no dates and opens Now. A drop
// that has already opened also starts at Now, so saving an edit keeps it open;
// an upcoming drop starts at Later with its saved London date and time.
export function dropBaseline(drop, now) {
  if (!drop) {
    return { dates: [], drop_time: "now", opens_on: "", opens_time: "" };
  }

  const dates = sortDates(drop.dates.map(normalizeDate));

  if (isDropOpen(drop, now)) {
    return { dates, drop_time: "now", opens_on: "", opens_time: "" };
  }

  const { localDate, localTime } = londonParts(new Date(toMillis(drop.opensAt)));

  return { dates, drop_time: "later", opens_on: localDate, opens_time: localTime };
}

const comparable = (draft) =>
  JSON.stringify({
    dates: sortDates(draft.dates.map(normalizeDate)),
    drop_time: draft.drop_time,
    opens:
      draft.drop_time === "later" ? [draft.opens_on, draft.opens_time] : null,
  });

export function isDraftDirty(draft, baseline) {
  return comparable(draft) !== comparable(baseline);
}

function parseDate(entry) {
  if (!entry || typeof entry !== "object" || !isValidLocalDate(entry.local_date)) {
    return { error: SAVE_FAILED_MESSAGE };
  }

  if (Array.isArray(entry.start_times) && entry.start_times.length > 0) {
    const times = entry.start_times.map((time) => String(time ?? ""));

    if (!times.every(isQuarterHour)) {
      return { error: TIMES_MESSAGE };
    }

    return {
      date: {
        local_date: entry.local_date,
        hours_start: null,
        hours_end: null,
        start_times: [...new Set(times)].sort(),
      },
    };
  }

  if (!entry.hours_start && !entry.hours_end) {
    return { error: MISSING_TIMES_MESSAGE };
  }

  const start = String(entry.hours_start ?? "");
  const end = String(entry.hours_end ?? "");

  if (!isQuarterHour(start) || !isQuarterHour(end) || end <= start) {
    return { error: TIMES_MESSAGE };
  }

  return {
    date: {
      local_date: entry.local_date,
      hours_start: start,
      hours_end: end,
      start_times: null,
    },
  };
}

// Reads the drop editor's hidden fields: drop_id, drop_time ('now' or
// 'later'), opens_on, opens_time and dates (JSON). Returns { value } with
// the arguments save_availability_drop takes, or { error } with the message
// to show. `now` decides whether a Later time has passed.
export function parseDropForm(formData, now = Date.now()) {
  const dropId = String(formData.get("drop_id") ?? "").trim() || null;
  const dropTime = String(formData.get("drop_time") ?? "").trim();

  let rawDates;

  try {
    rawDates = JSON.parse(String(formData.get("dates") ?? "[]"));
  } catch {
    return { error: SAVE_FAILED_MESSAGE };
  }

  if (!Array.isArray(rawDates)) {
    return { error: SAVE_FAILED_MESSAGE };
  }

  const dates = [];

  for (const entry of rawDates) {
    const parsed = parseDate(entry);

    if (parsed.error) {
      return { error: parsed.error };
    }

    dates.push(parsed.date);
  }

  if (dropTime === "now") {
    return {
      value: { dropId, opensOn: null, opensTime: null, dates: sortDates(dates) },
    };
  }

  if (dropTime !== "later") {
    return { error: SAVE_FAILED_MESSAGE };
  }

  const opensOn = String(formData.get("opens_on") ?? "").trim();
  const opensTime = String(formData.get("opens_time") ?? "").trim();

  if (!isValidLocalDate(opensOn) || !TIME_PATTERN.test(opensTime)) {
    return { error: LATER_INCOMPLETE_MESSAGE };
  }

  if (!isOnAppointmentGrid(opensTime)) {
    return { error: TIMES_MESSAGE };
  }

  const opensAt = londonInstant(opensOn, opensTime);

  if (opensAt !== null && opensAt <= toMillis(now)) {
    return { error: DROP_TIME_PASSED_MESSAGE };
  }

  return { value: { dropId, opensOn, opensTime, dates: sortDates(dates) } };
}
