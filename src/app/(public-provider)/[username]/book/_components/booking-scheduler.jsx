"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PickerTemplate } from "@/components/templates/picker-template";
import { Button } from "@/components/ui/button";
import { CommitBar } from "@/components/ui/commit-bar";
import { DayStrip } from "@/components/ui/day-strip";
import { EmptyState } from "@/components/ui/empty-state";
import { SlotGrid } from "@/components/ui/slot-grid";
import { addMinutes } from "../../_lib/public-provider-format";

// Five days visible, never seven — reviewers consistently read a full week as
// too much at once (02-components.md, "Day strip").
const CALENDAR_DAY_COUNT = 5;

// The slot labels are 24-hour (`09:00`), so the end time in the commit bar has
// to be too. `formatTimeLabel` is the 12-hour format used in prose elsewhere,
// and "09:00 until 9:10 am" reads as two different clocks.
function endTimeLabel(date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

function formatDateParts(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));

  return {
    weekday: new Intl.DateTimeFormat("en-GB", {
      weekday: "short",
      timeZone: "UTC",
    }).format(date),
    day: String(day),
    month: new Intl.DateTimeFormat("en-GB", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(date),
    full: new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(date),
  };
}

// T4 · Picker. Choosing a time still navigates to checkout with the chosen
// start in the URL — the only place the checkout page reads it from — so no
// server round trip happens before the navigation and nothing about the hold
// or the availability calculation changed.
//
// What changed is the shape: a slot is now selected and then committed from
// the bottom bar, rather than navigating on the first tap. The label is a
// plain `Continue`, not "Hold this slot": naming a mechanic the customer has
// not been told about yet reads as jargon.
// The picker is a client component because the day and slot selection live
// here, and the commit bar reads them — so it renders the template rather than
// sitting inside one, which keeps the bar in the slot the template reserves
// for it. `nav` and `subtitle` arrive from the server page as elements.
export default function BookingScheduler({
  availableDates,
  selectedAddOnIds,
  treatment,
  username,
  totalDurationMinutes,
  nav,
  subtitle,
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingSlot, setPendingSlot] = useState(null);
  const busy = isPending || pendingSlot !== null;

  const firstOpenIndex = Math.max(
    0,
    availableDates.findIndex((date) => date.slots.length > 0),
  );
  const [windowStart, setWindowStart] = useState(
    Math.floor(firstOpenIndex / CALENDAR_DAY_COUNT) * CALENDAR_DAY_COUNT,
  );
  const [selectedDate, setSelectedDate] = useState(
    availableDates[firstOpenIndex]?.local_date ?? null,
  );
  const [selectedStart, setSelectedStart] = useState(null);

  const windowDates = availableDates.slice(
    windowStart,
    windowStart + CALENDAR_DAY_COUNT,
  );
  const hasAnySlots = availableDates.some((date) => date.slots.length > 0);
  const activeDate = availableDates.find(
    (date) => date.local_date === selectedDate,
  );
  const selectedSlot = activeDate?.slots.find(
    (slot) => slot.start_at === selectedStart,
  );

  const days = useMemo(
    () =>
      windowDates.map((date) => {
        const parts = formatDateParts(date.local_date);

        return {
          value: date.local_date,
          weekdayLabel: parts.weekday,
          dayLabel: parts.day,
          // A day she does not work, or one already full, stays in the row at
          // 35% rather than disappearing — a gap in the strip reads as a bug.
          closed: date.slots.length === 0,
        };
      }),
    [windowDates],
  );

  function handleContinue() {
    if (!selectedSlot || busy) return;

    setPendingSlot(selectedSlot.start_at);

    startTransition(() => {
      const searchParams = new URLSearchParams({
        start_at: selectedSlot.start_at,
      });

      for (const addOnId of selectedAddOnIds) {
        searchParams.append("add_on", addOnId);
      }

      router.push(
        `/@${username}/book/${treatment.id}/checkout?${searchParams.toString()}`,
      );
    });
  }

  if (!hasAnySlots) {
    return (
      <PickerTemplate nav={nav} title="Pick a time" subtitle={subtitle}>
        <EmptyState title="No times in the next 60 days">
          This provider has nothing bookable right now. Her page shows when
          that changes.
        </EmptyState>
      </PickerTemplate>
    );
  }

  const endLabel = selectedSlot
    ? endTimeLabel(
        addMinutes(new Date(selectedSlot.start_at), totalDurationMinutes),
      )
    : "";

  return (
    <PickerTemplate
      nav={nav}
      title="Pick a time"
      subtitle={subtitle}
      dayStrip={
        <DayStrip
          monthLabel={
            windowDates[0] ? formatDateParts(windowDates[0].local_date).month : ""
          }
          days={days}
          value={selectedDate}
          onSelect={(date) => {
            setSelectedDate(date);
            setSelectedStart(null);
          }}
          onPrevious={
            windowStart > 0
              ? () =>
                  setWindowStart((current) =>
                    Math.max(0, current - CALENDAR_DAY_COUNT),
                  )
              : undefined
          }
          onNext={
            windowStart + CALENDAR_DAY_COUNT < availableDates.length
              ? () =>
                  setWindowStart((current) =>
                    Math.min(
                      Math.max(0, availableDates.length - CALENDAR_DAY_COUNT),
                      current + CALENDAR_DAY_COUNT,
                    ),
                  )
              : undefined
          }
        />
      }
      dayLabel={
        activeDate ? formatDateParts(activeDate.local_date).full : undefined
      }
      commitBar={
        <CommitBar
          contextLabel={selectedSlot ? selectedSlot.local_time : undefined}
          contextDetail={selectedSlot ? `until ${endLabel}` : undefined}
        >
          <Button
            block={!selectedSlot}
            onClick={handleContinue}
            disabled={!selectedSlot || busy}
            className={selectedSlot ? "px-8" : undefined}
          >
            Continue
          </Button>
        </CommitBar>
      }
    >
      {/* Only bookable starts appear. A start that cannot fit the treatment
          before closing time is simply absent, with no caption explaining the
          gaps. */}
      <SlotGrid
        slots={(activeDate?.slots ?? []).map((slot) => ({
          value: slot.start_at,
          label: slot.local_time,
        }))}
        value={selectedStart}
        onSelect={busy ? undefined : setSelectedStart}
      />
    </PickerTemplate>
  );
}
