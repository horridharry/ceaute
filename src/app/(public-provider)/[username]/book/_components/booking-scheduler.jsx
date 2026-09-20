"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

const CALENDAR_DAY_COUNT = 5;

function formatDateParts(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    weekday: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "Europe/London",
    }).format(date),
    weekdayLong: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      timeZone: "Europe/London",
    }).format(date),
    day: String(day),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      timeZone: "Europe/London",
    }).format(date),
  };
}

function firstDateWithSlots(dates, fromIndex = 0) {
  const match = dates
    .slice(fromIndex)
    .find((date) => date.slots.length > 0);

  return match ?? dates[fromIndex] ?? null;
}

export default function BookingScheduler({
  availableDates,
  selectedAddOnIds,
  treatment,
  username,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Stays set until the checkout page replaces this one, so the slots remain
  // disabled even once the transition itself has handed over to navigation.
  const [pendingSlot, setPendingSlot] = useState(null);
  const busy = isPending || pendingSlot !== null;
  const [calendarStartIndex, setCalendarStartIndex] = useState(0);
  const [selectedLocalDate, setSelectedLocalDate] = useState(
    () => firstDateWithSlots(availableDates)?.local_date ?? null,
  );

  const calendarDates = availableDates.slice(
    calendarStartIndex,
    calendarStartIndex + CALENDAR_DAY_COUNT,
  );
  const monthLabel = calendarDates[0]
    ? formatDateParts(calendarDates[0].local_date).month
    : "";
  const selectedDate =
    availableDates.find((date) => date.local_date === selectedLocalDate) ?? null;
  const hasAnySlots = availableDates.some((date) => date.slots.length > 0);

  // Paging the strip also moves the selection, so the grid below always shows a
  // day that is on screen.
  const goToWindow = (nextIndex) => {
    setCalendarStartIndex(nextIndex);
    setSelectedLocalDate(
      firstDateWithSlots(availableDates, nextIndex)?.local_date ?? null,
    );
  };

  // Choosing a time navigates straight to checkout. The chosen start travels
  // in the URL, which is the only place the checkout page reads it from, so no
  // server round trip happens before the navigation. The transition keeps the
  // chosen slot pending and the other slots disabled until checkout takes over.
  const handleSlotSelection = (slot) => {
    if (busy) {
      return;
    }

    setPendingSlot(slot.start_at);

    startTransition(() => {
      const searchParams = new URLSearchParams({
        start_at: slot.start_at,
      });

      for (const addOnId of selectedAddOnIds) {
        searchParams.append("add_on", addOnId);
      }

      router.push(
        `/@${username}/book/${treatment.id}/checkout?${searchParams.toString()}`,
      );
    });
  };

  const selectedParts = selectedDate
    ? formatDateParts(selectedDate.local_date)
    : null;

  return (
    <div className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-semibold tracking-tighter">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Earlier days"
            className="rounded-full px-3 py-1.5 text-lg leading-none text-accent-600 duration-200 hover:bg-accent-100 disabled:opacity-30"
            onClick={() =>
              goToWindow(Math.max(0, calendarStartIndex - CALENDAR_DAY_COUNT))
            }
            disabled={calendarStartIndex === 0}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Later days"
            className="rounded-full px-3 py-1.5 text-lg leading-none text-accent-600 duration-200 hover:bg-accent-100 disabled:opacity-30"
            onClick={() =>
              goToWindow(
                Math.min(
                  Math.max(0, availableDates.length - CALENDAR_DAY_COUNT),
                  calendarStartIndex + CALENDAR_DAY_COUNT,
                ),
              )
            }
            disabled={
              calendarStartIndex + CALENDAR_DAY_COUNT >= availableDates.length
            }
          >
            ›
          </button>
        </div>
      </div>

      <ul className="mt-3 flex gap-1 border-t border-black/8 pt-3">
        {calendarDates.map(({ local_date: localDate, slots }) => {
          const dateParts = formatDateParts(localDate);
          const isSelected = localDate === selectedLocalDate;

          return (
            <li key={localDate} className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setSelectedLocalDate(localDate)}
                disabled={slots.length === 0}
                aria-pressed={isSelected}
                className={`flex w-full flex-col items-center rounded-[10px] py-2 duration-200 disabled:opacity-30 ${
                  isSelected ? "bg-ink text-white" : "hover:bg-black/[0.04]"
                }`}
              >
                <span className="text-xs">{dateParts.weekday}</span>
                <span className="text-lg font-semibold tabular-nums">
                  {dateParts.day}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {selectedParts ? (
        <p className="mt-4 text-sm font-medium">
          {selectedParts.weekdayLong} {selectedParts.day}
        </p>
      ) : null}

      {selectedDate && selectedDate.slots.length ? (
        <ul className="mt-2 grid grid-cols-3 gap-2">
          {selectedDate.slots.map((slot) => (
            <li key={slot.start_at}>
              <button
                type="button"
                onClick={() => handleSlotSelection(slot)}
                disabled={busy}
                aria-busy={pendingSlot === slot.start_at ? true : undefined}
                className="w-full rounded-[10px] border border-black/12 py-3 text-sm font-medium tabular-nums duration-200 hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-50 aria-busy:border-accent-600 aria-busy:opacity-100"
              >
                {pendingSlot === slot.start_at ? "..." : slot.local_time}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {selectedDate && selectedDate.slots.length === 0 ? (
        <p className="mt-2 text-sm text-black/55">No times on this day.</p>
      ) : null}

      {!hasAnySlots ? (
        <p className="mt-4 text-center text-sm text-black/60">
          No available times in the next 60 days.
        </p>
      ) : null}
    </div>
  );
}
