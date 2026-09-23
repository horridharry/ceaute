"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { buttonClassName } from "@/components/ui/button-classes";
import { BOOKING_AVAILABILITY_CONSTANTS } from "../_lib/appointment-availability";
import {
  dayStatusWord,
  firstAvailableIndex,
  formatSlotTime,
  monthRangeLabel,
  groupSlotsByPartOfDay,
  nextAvailableIndex,
  shortDateLabel,
  unavailableDayMessage,
} from "../_lib/time-choices";

// The window comes from the calculator, which mirrors the hold rule in
// PostgreSQL; the copy never hard-codes it.
const { BOOKING_WINDOW_DAYS } = BOOKING_AVAILABILITY_CONSTANTS;

function checkoutHref({ username, treatmentId, addOnIds, startAt }) {
  const params = new URLSearchParams({ start_at: startAt });

  for (const addOnId of addOnIds) {
    params.append("add_on", addOnId);
  }

  return `/@${username}/book/${treatmentId}/checkout?${params.toString()}`;
}

function prefersReducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

// Revised 23 September 2026: the month is a heading above the day cards (no
// rail inside the strip), each unavailable card says "Closed", "Full" or "No
// times", the chosen day heads its times ("Friday 25"), and times are 24-hour
// in two columns, still grouped Morning, Afternoon and Evening. Only the
// presentation changed: the days and times are the calculator's.
//
// The day strip is a single-choice group: one day is selected, the arrow keys
// move between days, and only the selected day is a Tab stop, so a keyboard
// user does not tab through sixty buttons. Each button's accessible name is
// the full date and whether the day is closed or fully booked.
export function WhenSuitsYou({ days, providerName, username, treatmentId, addOnIds, initialDate = "" }) {
  const initialIndex = (() => {
    const requested = days.findIndex((day) => day.localDate === initialDate);
    if (requested !== -1) return requested;
    const first = firstAvailableIndex(days);
    return first === -1 ? 0 : first;
  })();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const [monthLabel, setMonthLabel] = useState(() => days[initialIndex]?.month ?? "");
  const dayRefs = useRef([]);
  const stripRef = useRef(null);
  const settleTimer = useRef(null);
  const selected = days[selectedIndex];

  // The month heading follows the cards in view.
  const measureMonths = useCallback(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const bounds = strip.getBoundingClientRect();
    let first = -1;
    let last = -1;
    dayRefs.current.forEach((node, index) => {
      if (!node) return;
      const box = node.getBoundingClientRect();
      if (box.right > bounds.left + 8 && box.left < bounds.right - 8) {
        if (first === -1) first = index;
        last = index;
      }
    });
    if (first !== -1) setMonthLabel(monthRangeLabel(days, first, last));
  }, [days]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  useEffect(() => {
    dayRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
    measureMonths();
  }, [selectedIndex, measureMonths]);

  if (days.length === 0 || firstAvailableIndex(days) === -1) {
    return (
      <div className="mt-8 rounded-xl border border-line p-4">
        <p className="font-medium">No times in the next {BOOKING_WINDOW_DAYS} days.</p>
        <p className="mt-1 text-sm text-ink-muted">
          {providerName} hasn’t opened any more dates yet. Try another treatment or check
          back later.
        </p>
      </div>
    );
  }

  const selectDay = (index, { focus = false } = {}) => {
    setSelectedIndex(index);
    if (focus) {
      dayRefs.current[index]?.focus();
    }
  };

  const onStripKeyDown = (event) => {
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

    if (event.key in moves) {
      event.preventDefault();
      const next = Math.min(days.length - 1, Math.max(0, selectedIndex + moves[event.key]));
      selectDay(next, { focus: true });
    } else if (event.key === "Home") {
      event.preventDefault();
      selectDay(0, { focus: true });
    } else if (event.key === "End") {
      event.preventDefault();
      selectDay(days.length - 1, { focus: true });
    }
  };

  const nextIndex = selected.status === "available" ? -1 : nextAvailableIndex(days, selectedIndex);

  return (
    <>
      <h2 className="mt-6 text-base font-semibold tracking-tight" aria-live="polite">
        {monthLabel}
      </h2>
      <div
        ref={stripRef}
        role="radiogroup"
        aria-label="Choose a day"
        onKeyDown={onStripKeyDown}
        onScroll={() => {
          clearTimeout(settleTimer.current);
          settleTimer.current = setTimeout(measureMonths, 60);
        }}
        className="-mx-5 mt-2 flex snap-x snap-mandatory scroll-px-5 items-stretch gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]"
      >
        {days.map((day, index) => {
          const isSelected = index === selectedIndex;
          const word = dayStatusWord(day);

          return (
            <button
              key={day.localDate}
              ref={(node) => {
                dayRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={day.label}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => selectDay(index)}
              className={[
                "flex min-h-[4.75rem] w-[60px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                isSelected
                  ? "border-ink bg-ink text-white"
                  : day.status === "closed"
                    ? "border-dashed border-line-strong bg-surface text-ink-subtle"
                    : day.status === "available"
                      ? "border-black/15 bg-surface text-ink hover:border-ink"
                      : "border-transparent bg-surface-subtle text-ink-subtle",
              ].join(" ")}
            >
              <span className={`text-xs ${isSelected ? "text-white/80" : day.status === "available" ? "text-ink-muted" : ""}`}>
                {day.weekday}
              </span>
              <span className="text-lg font-semibold tabular-nums">{day.day}</span>
              <span aria-hidden="true" className="h-3.5 text-[10.5px] font-semibold leading-none">
                {word}
              </span>
            </button>
          );
        })}
      </div>

      <section aria-labelledby="chosen-day" className="mt-5">
        <h2 id="chosen-day" className="text-lg font-semibold tracking-tight">
          {selected.weekdayLong} {selected.day}
          <span className="sr-only"> {selected.month}</span>
        </h2>

        {selected.status === "available" ? (
          groupSlotsByPartOfDay(selected.slots).map((group) => (
            <section key={group.part} aria-labelledby={`part-${group.part}`} className="mt-4">
              <h3 id={`part-${group.part}`} className="text-[13px] font-semibold text-ink-muted">
                {group.part}
              </h3>
              <ul className="mt-2 grid grid-cols-2 gap-2">
                {group.slots.map((slot) => (
                  <li key={slot.start_at}>
                    <Link
                      href={checkoutHref({ username, treatmentId, addOnIds, startAt: slot.start_at })}
                      prefetch={false}
                      className="flex min-h-12 items-center justify-center rounded-[10px] border border-black/15 bg-surface text-[15px] font-semibold tabular-nums hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                    >
                      {formatSlotTime(slot.local_time)}
                      <LinkPendingHint />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="mt-2 rounded-xl border border-line p-4">
            <p>{unavailableDayMessage(selected, providerName)}</p>
            {nextIndex !== -1 ? (
              <button
                type="button"
                onClick={() => selectDay(nextIndex, { focus: true })}
                className={buttonClassName({ variant: "secondary", size: "compact", className: "mt-3" })}
              >
                Next available: {shortDateLabel(days[nextIndex])}
              </button>
            ) : (
              <p className="mt-1 text-sm text-ink-muted">
                There are no more times in the next {BOOKING_WINDOW_DAYS} days.
              </p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
