"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { storeSelectedBookingTime } from "../actions";

const CALENDAR_DAY_COUNT = 3;

function formatDateParts(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    weekday: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "Europe/London",
    }).format(date),
    day: String(day),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      timeZone: "Europe/London",
    }).format(date),
  };
}

export default function BookingScheduler({
  availableDates,
  selectedAddOnIds,
  treatment,
  username,
}) {
  const router = useRouter();
  const [calendarStartIndex, setCalendarStartIndex] = useState(0);
  const calendarDates = availableDates.slice(
    calendarStartIndex,
    calendarStartIndex + CALENDAR_DAY_COUNT,
  );
  const monthLabel = calendarDates[0]
    ? formatDateParts(calendarDates[0].local_date).month
    : "";
  const hasAnySlots = availableDates.some((date) => date.slots.length > 0);

  const handleSlotSelection = async (slot) => {
    await storeSelectedBookingTime(slot.start_at);
    const searchParams = new URLSearchParams({
      start_at: slot.start_at,
    });

    for (const addOnId of selectedAddOnIds) {
      searchParams.append("add_on", addOnId);
    }

    router.push(
      `/@${username}/booking/${treatment.id}/details?${searchParams.toString()}`,
    );
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
              setCalendarStartIndex((currentIndex) =>
                Math.max(0, currentIndex - CALENDAR_DAY_COUNT),
              )
            }
            disabled={calendarStartIndex === 0}
          >
            Back
          </button>

          <button
            type="button"
            className="rounded-full p-1.5 px-3 text-sm font-medium text-pink-700 duration-200 hover:bg-pink-100 active:underline"
            onClick={() =>
              setCalendarStartIndex((currentIndex) =>
                Math.min(
                  Math.max(0, availableDates.length - CALENDAR_DAY_COUNT),
                  currentIndex + CALENDAR_DAY_COUNT,
                ),
              )
            }
            disabled={calendarStartIndex + CALENDAR_DAY_COUNT >= availableDates.length}
          >
            Next
          </button>
        </div>
      </div>
      <ul className="mt-3 flex justify-around border-t pt-4">
        {calendarDates.map(({ local_date: localDate, slots }) => {
          const dateParts = formatDateParts(localDate);

          return (
          <li
            key={localDate}
            className="flex flex-1 flex-col items-center px-1.5"
          >
            <p className="text-sm">{dateParts.weekday}</p>
            <p className="text-xl font-semibold">{dateParts.day}</p>
            <div className="mt-3 flex w-full flex-col gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.start_at}
                  type="button"
                  onClick={() => handleSlotSelection(slot)}
                  className="w-full rounded-lg border border-gray-200 p-4 text-sm font-medium duration-200 hover:border-black/30 hover:bg-gray-100"
                >
                  {slot.local_time}
                </button>
              ))}
              {slots.length === 0 ? (
                <p className="rounded-lg border border-gray-200 p-4 text-center text-xs text-black/40">
                  No times
                </p>
              ) : null}
            </div>
          </li>
          );
        })}
      </ul>
      {!hasAnySlots ? (
        <p className="p-4 text-center text-sm text-black/60">
          No available times in the next 60 days.
        </p>
      ) : null}
    </>
  );
}
