import { APPOINTMENT_GRID_MINUTES } from "../../../../../lib/bookings/appointment-grid.js";

// Fixed MVP rules, mirrored from ceaute.create_validated_booking_hold
// (202609270001), which is authoritative. There is no booking window: every
// open date is offered however far ahead. A start is offered only on a date
// the provider has opened (get_public_open_dates returns only dates of opened
// drops), inside that date's hours or at one of its start times, at least 24
// hours ahead, on the 15-minute grid, and ending on the London date it starts.
const MINIMUM_NOTICE_HOURS = 24;
const PROVIDER_TIME_ZONE = "Europe/London";
const MINUTES_PER_DAY = 24 * 60;

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

// The candidate starts of one open date, in minutes after local midnight. A
// date has either hours (one opening and one closing time) or a list of start
// times, never both. Stored hours are on the grid, so stepping from the
// opening time keeps every start on it; the duration only decides whether the
// appointment fits. A start-times date offers exactly its listed starts, and
// any treatment may begin at one of them.
function candidateStartMinutes(openDate, durationMinutes) {
  if (openDate.start_times == null) {
    const openMinutes = timeToMinutes(openDate.hours_start);
    const closeMinutes = timeToMinutes(openDate.hours_end);
    const starts = [];

    for (
      let slotMinutes = openMinutes;
      slotMinutes + durationMinutes <= closeMinutes;
      slotMinutes += APPOINTMENT_GRID_MINUTES
    ) {
      starts.push(slotMinutes);
    }

    return starts;
  }

  return openDate.start_times.map(timeToMinutes);
}

export function calculateAvailableAppointmentTimes({
  now = new Date(),
  openDates,
  appointments,
  durationMinutes,
  timeZone = PROVIDER_TIME_ZONE,
}) {
  const today = localDateStringFromInstant(now, timeZone);
  const minimumStart = new Date(
    now.getTime() + MINIMUM_NOTICE_HOURS * 60 * 60_000,
  );
  const sortedOpenDates = [...openDates]
    .filter((openDate) => openDate.local_date >= today)
    .sort((first, second) => first.local_date.localeCompare(second.local_date));
  const dates = [];

  for (const openDate of sortedOpenDates) {
    const localDate = openDate.local_date;
    const slots = [];
    // Why a day has no times, for the day picker only; it never changes which
    // starts are offered. "short": this appointment fits at no start.
    // "notice": every start that fits is inside the 24 hours' notice. "full":
    // starts fit and are far enough ahead, but all are taken.
    let fittingStarts = 0;
    let startsAfterNotice = 0;

    for (const slotMinutes of candidateStartMinutes(openDate, durationMinutes)) {
      // The hold check refuses an appointment that ends on a later date than
      // it starts, so one ending at or after midnight is never offered.
      if (slotMinutes + durationMinutes >= MINUTES_PER_DAY) {
        continue;
      }

      const startAt = localDateTimeToInstant({
        localDate,
        localTime: minutesToTime(slotMinutes),
        timeZone,
      });

      if (!startAt) {
        continue;
      }

      fittingStarts += 1;

      if (startAt < minimumStart) {
        continue;
      }

      startsAfterNotice += 1;
      const endAt = new Date(startAt.getTime() + durationMinutes * 60_000);

      if (!overlapsExistingAppointment(startAt, endAt, appointments)) {
        slots.push({
          start_at: startAt.toISOString(),
          local_time: minutesToTime(slotMinutes),
        });
      }
    }

    let unavailableReason = null;

    if (slots.length === 0) {
      unavailableReason =
        fittingStarts === 0 ? "short" : startsAfterNotice === 0 ? "notice" : "full";
    }

    dates.push({ local_date: localDate, slots, unavailable_reason: unavailableReason });
  }

  return dates;
}

export const BOOKING_AVAILABILITY_CONSTANTS = {
  MINIMUM_NOTICE_HOURS,
  PROVIDER_TIME_ZONE,
  APPOINTMENT_GRID_MINUTES,
};
