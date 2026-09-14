import { APPOINTMENT_GRID_MINUTES } from "../../../../../lib/bookings/appointment-grid.js";

// Fixed MVP rules, mirrored from ceaute.create_validated_booking_hold, which is
// authoritative. The window is inclusive: starts are offered through the 60th
// Europe/London calendar day after today. It is not provider-configurable.
const BOOKING_WINDOW_DAYS = 60;
const MINIMUM_NOTICE_HOURS = 24;
const PROVIDER_TIME_ZONE = "Europe/London";

function pad(value) {
  return String(value).padStart(2, "0");
}

function localPartsFromInstant(instant, timeZone = PROVIDER_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const getPart = (type) => Number(parts.find((part) => part.type === type)?.value);

  return {
    year: getPart("year"),
    month: getPart("month"),
    day: getPart("day"),
    hour: getPart("hour"),
    minute: getPart("minute"),
    second: getPart("second"),
  };
}

function localDateStringFromInstant(instant, timeZone = PROVIDER_TIME_ZONE) {
  const { year, month, day } = localPartsFromInstant(instant, timeZone);
  return `${year}-${pad(month)}-${pad(day)}`;
}

function offsetMinutesForInstant(instant, timeZone = PROVIDER_TIME_ZONE) {
  const parts = localPartsFromInstant(instant, timeZone);
  const localAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );

  return (localAsUtc - instant.getTime()) / 60_000;
}

export function localDateTimeToInstant({
  localDate,
  localTime,
  timeZone = PROVIDER_TIME_ZONE,
}) {
  const [year, month, day] = localDate.split("-").map(Number);
  const [hour, minute] = localTime.split(":").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  let instant = new Date(
    utcGuess - offsetMinutesForInstant(new Date(utcGuess), timeZone) * 60_000,
  );
  const refinedOffset = offsetMinutesForInstant(instant, timeZone);
  instant = new Date(utcGuess - refinedOffset * 60_000);

  const parts = localPartsFromInstant(instant, timeZone);
  if (
    parts.year !== year ||
    parts.month !== month ||
    parts.day !== day ||
    parts.hour !== hour ||
    parts.minute !== minute
  ) {
    return null;
  }

  return instant;
}

function addLocalDays(localDate, days) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days, 12));

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function weekdayForLocalDate(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
}

function timeToMinutes(timeValue) {
  const [hours, minutes] = String(timeValue).slice(0, 5).split(":").map(Number);
  return hours * 60 + minutes;
}

function minutesToTime(minutes) {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function overlapsExistingAppointment(startAt, endAt, appointments) {
  return appointments.some((appointment) => {
    const appointmentStart = new Date(appointment.start_at);
    const appointmentEnd = new Date(appointment.end_at);

    return startAt < appointmentEnd && endAt > appointmentStart;
  });
}

export function calculateAvailableAppointmentTimes({
  now = new Date(),
  availabilityRules,
  blockedDates,
  appointments,
  durationMinutes,
  timeZone = PROVIDER_TIME_ZONE,
}) {
  const today = localDateStringFromInstant(now, timeZone);
  const latestDate = addLocalDays(today, BOOKING_WINDOW_DAYS);
  const minimumStart = new Date(
    now.getTime() + MINIMUM_NOTICE_HOURS * 60 * 60_000,
  );
  const blockedDateSet = new Set(blockedDates);
  const rulesByWeekday = new Map(
    availabilityRules.map((rule) => [Number(rule.weekday), rule]),
  );
  const dates = [];

  for (
    let localDate = today;
    localDate <= latestDate;
    localDate = addLocalDays(localDate, 1)
  ) {
    const rule = rulesByWeekday.get(weekdayForLocalDate(localDate));
    const slots = [];

    if (rule && !blockedDateSet.has(localDate)) {
      const openMinutes = timeToMinutes(rule.starts_at);
      const closeMinutes = timeToMinutes(rule.ends_at);

      // Stored opening times are on the grid, so stepping from them keeps every
      // start on it. The duration only decides whether the appointment fits.
      for (
        let slotMinutes = openMinutes;
        slotMinutes + durationMinutes <= closeMinutes;
        slotMinutes += APPOINTMENT_GRID_MINUTES
      ) {
        const startAt = localDateTimeToInstant({
          localDate,
          localTime: minutesToTime(slotMinutes),
          timeZone,
        });

        if (!startAt || startAt < minimumStart) {
          continue;
        }

        const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

        if (!overlapsExistingAppointment(startAt, endAt, appointments)) {
          slots.push({
            start_at: startAt.toISOString(),
            local_time: minutesToTime(slotMinutes),
          });
        }
      }
    }

    dates.push({ local_date: localDate, slots });
  }

  return dates;
}

export const BOOKING_AVAILABILITY_CONSTANTS = {
  BOOKING_WINDOW_DAYS,
  MINIMUM_NOTICE_HOURS,
  PROVIDER_TIME_ZONE,
  APPOINTMENT_GRID_MINUTES,
};
