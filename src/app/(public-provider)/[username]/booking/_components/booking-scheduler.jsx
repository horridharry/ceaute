"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeSelectedBookingTime } from "../actions";
import { formatTimeLabel } from "../../_lib/public-provider-format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const CALENDAR_DAY_COUNT = 3;

function parseTimeParts(timeValue) {
  const [hours = "0", minutes = "0"] = String(timeValue).split(":");
  return {
    hours: Number(hours),
    minutes: Number(minutes),
  };
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function buildSlotsForDate(date, availabilityRules, durationMinutes) {
  const rule = availabilityRules.find(
    (availabilityRule) => availabilityRule.weekday === date.getDay(),
  );

  if (!rule) {
    return [];
  }

  const { hours: startHour, minutes: startMinute } = parseTimeParts(
    rule.starts_at,
  );
  const { hours: endHour, minutes: endMinute } = parseTimeParts(rule.ends_at);
  const firstSlot = new Date(date);
  firstSlot.setHours(startHour, startMinute, 0, 0);

  const endOfWorkingDay = new Date(date);
  endOfWorkingDay.setHours(endHour, endMinute, 0, 0);

  const minimumStart = new Date(Date.now() + 24 * 60 * 60_000);
  const slots = [];
  let currentSlot = firstSlot;

  while (currentSlot.getTime() + durationMinutes * 60_000 <= endOfWorkingDay) {
    if (currentSlot >= minimumStart) {
      slots.push(new Date(currentSlot));
    }

    currentSlot = new Date(currentSlot.getTime() + 15 * 60_000);
  }

  return slots;
}

function buildCalendarDates(calendarStartDate, availabilityRules, durationMinutes) {
  return Array.from({ length: CALENDAR_DAY_COUNT }, (_, index) => {
    const date = addDays(calendarStartDate, index);

    return {
      date,
      slots: buildSlotsForDate(date, availabilityRules, durationMinutes),
    };
  });
}

export default function BookingScheduler({
  availabilityRules,
  treatment,
  username,
}) {
  const router = useRouter();
  const [calendarStartDate, setCalendarStartDate] = useState(() =>
    startOfDay(addDays(new Date(), 1)),
  );
  const calendarDates = buildCalendarDates(
    calendarStartDate,
    availabilityRules,
    treatment.duration_minutes,
  );
  const monthLabel = new Intl.DateTimeFormat("en-GB", {
    month: "long",
  }).format(calendarDates[0].date);

  const handleSlotSelection = async (slot) => {
    await storeSelectedBookingTime(slot.toISOString());
    router.push(`/@${username}/booking/${treatment.id}/details`);
  };

  return (
    <>
      <div className="flex items-center justify-between p-4">
        <p className="text-2xl font-semibold tracking-tighter">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full p-1.5 px-3 text-sm font-medium text-pink-700 duration-200 hover:bg-pink-100 active:underline"
            onClick={() =>
              setCalendarStartDate((currentDate) =>
                addDays(currentDate, -CALENDAR_DAY_COUNT),
              )
            }
          >
            Back
          </button>

          <button
            type="button"
            className="rounded-full p-1.5 px-3 text-sm font-medium text-pink-700 duration-200 hover:bg-pink-100 active:underline"
            onClick={() =>
              setCalendarStartDate((currentDate) =>
                addDays(currentDate, CALENDAR_DAY_COUNT),
              )
            }
          >
            Next
          </button>
        </div>
      </div>
      <ul className="mt-3 flex justify-around border-t pt-4">
        {calendarDates.map(({ date, slots }) => (
          <li
            key={date.toISOString()}
            className="flex flex-1 flex-col items-center px-1.5"
          >
            <p className="text-sm">{WEEKDAYS[date.getDay()]}</p>
            <p className="text-xl font-semibold">{date.getDate()}</p>
            <div className="mt-3 flex w-full flex-col gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.toISOString()}
                  type="button"
                  onClick={() => handleSlotSelection(slot)}
                  className="w-full rounded-lg border border-gray-200 p-4 text-sm font-medium duration-200 hover:border-black/30 hover:bg-gray-100"
                >
                  {formatTimeLabel(slot)}
                </button>
              ))}
              {slots.length === 0 ? (
                <p className="rounded-lg border border-gray-200 p-4 text-center text-xs text-black/40">
                  No times
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
