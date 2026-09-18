"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

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
  const [isPending, startTransition] = useTransition();
  // Stays set until the checkout page replaces this one, so the slots remain
  // disabled even once the transition itself has handed over to navigation.
  const [pendingSlot, setPendingSlot] = useState(null);
  const busy = isPending || pendingSlot !== null;
  const [calendarStartIndex, setCalendarStartIndex] = useState(0);
  const calendarDates = availableDates.slice(
    calendarStartIndex,
    calendarStartIndex + CALENDAR_DAY_COUNT,
  );
  const monthLabel = calendarDates[0]
    ? formatDateParts(calendarDates[0].local_date).month
    : "";
  const hasAnySlots = availableDates.some((date) => date.slots.length > 0);

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

  return (
    <>
      <div className="flex items-center justify-between p-4">
        <p className="text-2xl font-semibold tracking-tighter">{monthLabel}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full p-1.5 px-3 text-sm font-medium text-plum duration-200 hover:bg-surface active:underline"
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
            className="rounded-full p-1.5 px-3 text-sm font-medium text-plum duration-200 hover:bg-surface active:underline"
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
                  disabled={busy}
                  aria-busy={pendingSlot === slot.start_at ? true : undefined}
                  className="w-full rounded-lg border border-black/12 p-4 text-sm font-medium duration-200 hover:border-black/30 hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50 aria-busy:border-plum aria-busy:opacity-100"
                >
                  {pendingSlot === slot.start_at ? "Choosing..." : slot.local_time}
                </button>
              ))}
              {slots.length === 0 ? (
                <p className="rounded-lg border border-black/12 p-4 text-center text-xs text-black/40">
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
