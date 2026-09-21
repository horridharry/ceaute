import {
  APPOINTMENT_GRID_MINUTES,
  isOnAppointmentGrid,
} from "@/lib/bookings/appointment-grid";
import { weekdayNameToNumber, weekdayNumberToName } from "./weekdays";

export const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export const generateTimeOptions = (intervalMinutes = APPOINTMENT_GRID_MINUTES) => {
  const timeOptions = [];

  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += intervalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const label = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
      "en-GB",
      { hour: "numeric", minute: "2-digit", hourCycle: "h12" },
    );

    timeOptions.push({ value, label });
  }

  return timeOptions;
};

const defaultDay = (dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
});

export function scheduleToState(schedule) {
  return DAYS_OF_WEEK.map(({ value }) => {
    const daySchedule = schedule.find((entry) => entry.day_of_week === value);

    if (!daySchedule) {
      return {
        ...defaultDay(value),
        enabled: false,
      };
    }

    return {
      dayOfWeek: value,
      enabled: true,
      openTime: String(daySchedule.start_time).slice(0, 5),
      closeTime: String(daySchedule.end_time).slice(0, 5),
    };
  });
}

export function getErrors(days) {
  return Object.fromEntries(
    days
      .filter((day) => day.enabled && day.closeTime <= day.openTime)
      .map((day) => [day.dayOfWeek, "Closing time must be after opening time."]),
  );
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const isWeekdayName = (value) => DAYS_OF_WEEK.some((day) => day.value === value);

const dayLabel = (dayOfWeek) =>
  DAYS_OF_WEEK.find((day) => day.value === dayOfWeek)?.label ?? dayOfWeek;

// Reads the weekly-hours form into the rules replace_provider_availability_rules
// expects. PostgreSQL enforces the same rules again; this only gives the
// provider a readable message first.
export function parseSchedule(formData) {
  const enabledDays = formData
    .getAll("enabled_weekday")
    .map((day) => String(day ?? "").trim().toLowerCase());
  const uniqueEnabledDays = new Set(enabledDays);

  if (enabledDays.length !== uniqueEnabledDays.size) {
    return { error: "Each weekday can only be saved once." };
  }

  const schedule = [];

  for (const dayOfWeek of enabledDays) {
    if (!isWeekdayName(dayOfWeek)) {
      return { error: "Choose valid weekdays only." };
    }

    const openTime = String(formData.get(`${dayOfWeek}_starts_at`) ?? "").trim();
    const closeTime = String(formData.get(`${dayOfWeek}_ends_at`) ?? "").trim();

    if (!TIME_PATTERN.test(openTime) || !TIME_PATTERN.test(closeTime)) {
      return { error: "Choose valid opening and closing times." };
    }

    if (!isOnAppointmentGrid(openTime) || !isOnAppointmentGrid(closeTime)) {
      return {
        error:
          "Opening and closing times must be on 15-minute boundaries, such as 09:00 or 09:15.",
      };
    }

    if (closeTime <= openTime) {
      return { error: "Closing time must be after opening time." };
    }

    schedule.push({
      weekday: weekdayNameToNumber(dayOfWeek),
      starts_at: openTime,
      ends_at: closeTime,
    });
  }

  return { schedule };
}

// Builds exactly the fields parseSchedule reads, so the editor can submit its
// draft even though collapsed rows render no inputs. Closed days add nothing.
export function scheduleToFormData(days) {
  const formData = new FormData();

  for (const day of days) {
    if (!day.enabled) {
      continue;
    }

    formData.append("enabled_weekday", day.dayOfWeek);
    formData.append(`${day.dayOfWeek}_starts_at`, day.openTime);
    formData.append(`${day.dayOfWeek}_ends_at`, day.closeTime);
  }

  return formData;
}

// "09:00" → "9 am", "19:30" → "7:30 pm", "00:00" → "12 am".
export function formatSummaryTime(time) {
  const [hours, minutes] = String(time).split(":").map(Number);
  const period = hours < 12 ? "am" : "pm";
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;

  if (minutes === 0) {
    return `${displayHours} ${period}`;
  }

  return `${displayHours}:${String(minutes).padStart(2, "0")} ${period}`;
}

export function formatDaySummary(day) {
  if (!day.enabled) {
    return "Closed";
  }

  return `${formatSummaryTime(day.openTime)} to ${formatSummaryTime(day.closeTime)}`;
}

// Times remembered on a closed day don't count, so ticking a day open and
// closed again leaves no change.
export function isSameDay(a, b) {
  if (!a.enabled || !b.enabled) {
    return !a.enabled && !b.enabled;
  }

  return a.openTime === b.openTime && a.closeTime === b.closeTime;
}

export function getChangedDays(draft, baseline) {
  return DAYS_OF_WEEK.map(({ value }) => value).filter((dayOfWeek) => {
    const draftDay = draft.find((day) => day.dayOfWeek === dayOfWeek);
    const baselineDay = baseline.find((day) => day.dayOfWeek === dayOfWeek);

    if (!draftDay || !baselineDay) {
      return Boolean(draftDay) !== Boolean(baselineDay);
    }

    return !isSameDay(draftDay, baselineDay);
  });
}

export function hasNoOpenDays(days) {
  return !days.some((day) => day.enabled);
}

export function formatChangedCount(count) {
  return count === 1 ? "1 day changed" : `${count} days changed`;
}

// Takes the invalid dayOfWeek values, for example Object.keys(getErrors(draft)).
export function formatInvalidMessage(invalidDays) {
  if (invalidDays.length === 1) {
    return `Fix ${dayLabel(invalidDays[0])}'s hours to save`;
  }

  return `Fix the hours on ${invalidDays.length} days to save`;
}

// Blocked dates are plain local dates. Anchoring them at 12:00 UTC keeps the
// calendar day the same in Europe/London on both sides of a clock change.
const localDateToNoonUtc = (localDate) => {
  const [year, month, day] = localDate.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, day, 12));
};

// "Friday 3 October", with the year added when it isn't today's year.
export function formatBlockedDate(localDate, today) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).formatToParts(localDateToNoonUtc(localDate));
  const getPart = (type) => parts.find((part) => part.type === type)?.value;
  const label = `${getPart("weekday")} ${getPart("day")} ${getPart("month")}`;
  const sameYear = localDate.slice(0, 4) === String(today ?? "").slice(0, 4);

  return sameYear ? label : `${label} ${getPart("year")}`;
}

const localDateWeekday = (localDate) =>
  weekdayNumberToName(localDateToNoonUtc(localDate).getUTCDay());

// True when the week is closed on this date's weekday, so the block changes
// nothing for customers.
export function isBlockedDateOnClosedWeekday(localDate, days) {
  const dayOfWeek = localDateWeekday(localDate);

  return !days.some((day) => day.dayOfWeek === dayOfWeek && day.enabled);
}

export function formatClosedAnyway(localDate) {
  return `You're closed on ${dayLabel(localDateWeekday(localDate))}s anyway`;
}
