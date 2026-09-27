// Reading a time the provider types on the Availability screen: "7pm",
// "7:30 pm", "7.30pm", "19:00", "19.00" or "1900". Values are 'HH:MM', 24-hour,
// on the quarter hour, as parseDropForm and save_availability_drop take them;
// the provider reads them back through formatClockTime ("7 pm", "7:30 pm").
// Nothing here rounds: a time off the quarter hour is refused with a message.
import { APPOINTMENT_GRID_MINUTES } from "@/lib/bookings/appointment-grid";

export const TIME_TEXT_MESSAGE = "Type a time, like 7 pm or 19:00.";
export const QUARTER_HOUR_MESSAGE =
  "Use a time on the quarter hour, like 7:15 pm.";

export const MAX_TIME_SUGGESTIONS = 6;

const QUARTERS = Array.from(
  { length: 60 / APPOINTMENT_GRID_MINUTES },
  (_, index) => index * APPOINTMENT_GRID_MINUTES,
);

// Digits, then an optional ':' or '.' with up to two minute digits, then an
// optional am/pm written as a, am, a.m. (or p, pm, p.m.). Spaces are removed
// before matching.
const TIME_TEXT_PATTERN = /^(\d{1,4})(?:[:.](\d{0,2}))?(?:([ap])\.?(?:m\.?)?)?$/;

const pad = (value) => String(value).padStart(2, "0");
const toValue = (hour, minute) => `${pad(hour)}:${pad(minute)}`;

// The 24-hour hours a written hour can mean, most likely first, or [] when it
// can't be an hour. With am/pm it must be 1 to 12. Without, 0, 13 to 23 and a
// leading zero ("07") read as 24-hour; 1 to 12 could be either, so both are
// kept: morning first, except 12, which is noon first.
function hourCandidates(hourText, period) {
  const hour = Number(hourText);

  if (period) {
    if (hour < 1 || hour > 12) return [];
    return [period === "a" ? hour % 12 : (hour % 12) + 12];
  }

  if (hour > 23) return [];

  if (hour === 0 || hour >= 13 || (hourText.length === 2 && hourText[0] === "0")) {
    return [hour];
  }

  return hour === 12 ? [12, 0] : [hour, hour + 12];
}

// One way of splitting the typed digits into an hour and minutes.
// `minute` is a number when both minute digits were typed; otherwise
// `minutePrefix` is what was typed after the separator ('' or one digit), or
// null when only an hour was typed.
function readParts({ hourText, minuteText, hasSeparator, period }) {
  const hours = hourCandidates(hourText, period);

  if (hours.length === 0) return null;

  if (minuteText !== null && minuteText.length === 2) {
    const minute = Number(minuteText);
    return minute < 60 ? { hours, minute, minutePrefix: null } : null;
  }

  return {
    hours,
    minute: null,
    minutePrefix: hasSeparator ? (minuteText ?? "") : null,
  };
}

// How the typed text splits into an hour and minutes, or null when it can't
// be a time. "1900" and "0730" are an hour and minutes and "730" is 7:30;
// "190" can't be 1:90, so it is 19 with the minutes still being typed, and
// typing "1900" suggests 7 pm before the last digit.
function readText(text) {
  const compact = String(text ?? "").toLowerCase().replace(/\s+/g, "");
  const match = TIME_TEXT_PATTERN.exec(compact);

  if (!match) return null;

  const [, digits, separatorMinutes, period = null] = match;

  if (separatorMinutes !== undefined) {
    return digits.length > 2
      ? null
      : readParts({ hourText: digits, minuteText: separatorMinutes, hasSeparator: true, period });
  }

  if (digits.length <= 2) {
    return readParts({ hourText: digits, minuteText: null, hasSeparator: false, period });
  }

  const split = digits.length - 2;
  const whole = readParts({
    hourText: digits.slice(0, split),
    minuteText: digits.slice(split),
    hasSeparator: true,
    period,
  });

  if (whole || digits.length === 4) return whole;

  return readParts({
    hourText: digits.slice(0, 2),
    minuteText: digits.slice(2),
    hasSeparator: true,
    period,
  });
}

const isQuarter = (minute) => minute % APPOINTMENT_GRID_MINUTES === 0;

// The quarter-hour minutes a reading allows. After a separator with nothing
// typed yet, the whole hour is left out: "7:" is on its way to minutes.
function readingMinutes(reading) {
  if (reading.minute !== null) {
    return isQuarter(reading.minute) ? [reading.minute] : [];
  }

  if (reading.minutePrefix === null) {
    return QUARTERS;
  }

  if (reading.minutePrefix === "") {
    return QUARTERS.filter((minute) => minute !== 0);
  }

  return QUARTERS.filter((minute) => pad(minute).startsWith(reading.minutePrefix));
}

// What the provider has typed so far:
//   kind 'empty'       nothing typed
//   kind 'time'        one quarter-hour time; `value` is it as 'HH:MM'
//   kind 'ambiguous'   a quarter-hour time without am or pm, such as "7"
//   kind 'partial'     minutes still being typed, such as "7:" or "7:1"
//   kind 'off-quarter' a time that isn't on the quarter hour, such as "7:10 pm"
//   kind 'invalid'     not a time
// `suggestions` are up to six 'HH:MM' values to offer, whole hours for the
// typed hour first, then its quarter hours; `value` is '' unless kind is 'time'.
export function readTimeText(text) {
  if (String(text ?? "").trim() === "") {
    return { kind: "empty", value: "", suggestions: [] };
  }

  const reading = readText(text);

  if (!reading) {
    return { kind: "invalid", value: "", suggestions: [] };
  }

  const minutes = readingMinutes(reading);
  const suggestions = minutes
    .flatMap((minute) => reading.hours.map((hour) => toValue(hour, minute)))
    .slice(0, MAX_TIME_SUGGESTIONS);

  if (minutes.length === 0) {
    return { kind: "off-quarter", value: "", suggestions: [] };
  }

  if (reading.minute === null && reading.minutePrefix !== null) {
    return { kind: "partial", value: "", suggestions };
  }

  if (reading.hours.length > 1) {
    return { kind: "ambiguous", value: "", suggestions };
  }

  return {
    kind: "time",
    value: toValue(reading.hours[0], reading.minute ?? 0),
    suggestions,
  };
}

// The message to show when the provider leaves or confirms the field with
// this text, or '' when there is nothing to say: a time is taken as it is, and
// text with suggestions waits for one to be chosen.
export function timeTextError(reading) {
  if (reading.kind === "invalid") return TIME_TEXT_MESSAGE;
  if (reading.kind === "off-quarter") return QUARTER_HOUR_MESSAGE;
  return "";
}
