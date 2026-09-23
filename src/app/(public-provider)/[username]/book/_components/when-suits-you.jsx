"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LinkPendingHint } from "@/components/link-pending-hint";
import { buttonClassName } from "@/components/ui/button-classes";
import {
  firstAvailableIndex,
  formatSlotTime,
  groupSlotsByPartOfDay,
  nextAvailableIndex,
  shortDateLabel,
  unavailableDayMessage,
} from "../_lib/time-choices";

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

// The day strip is a single-choice group: one day is selected, the arrow keys
// move between days, and only the selected day is a Tab stop, so a keyboard
// user does not tab through sixty buttons. Each button shows the short weekday
// and the date only; its accessible name is the full date and whether the day
// is closed or fully booked.
export function WhenSuitsYou({ days, providerName, username, treatmentId, addOnIds, initialDate = "" }) {
  const initialIndex = (() => {
    const requested = days.findIndex((day) => day.localDate === initialDate);
    if (requested !== -1) return requested;
    const first = firstAvailableIndex(days);
    return first === -1 ? 0 : first;
  })();
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);
  const dayRefs = useRef([]);
  const selected = days[selectedIndex];

  useEffect(() => {
    dayRefs.current[selectedIndex]?.scrollIntoView({
      block: "nearest",
      inline: "center",
      behavior: prefersReducedMotion() ? "auto" : "smooth",
    });
  }, [selectedIndex]);

  if (days.length === 0 || firstAvailableIndex(days) === -1) {
    return (
      <div className="mt-8 rounded-xl border border-line p-4">
        <p className="font-medium">No times in the next 60 days.</p>
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
      <div
        role="radiogroup"
        aria-label="Choose a day"
        onKeyDown={onStripKeyDown}
        className="-mx-5 mt-5 flex snap-x snap-mandatory scroll-px-5 items-stretch gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none]"
      >
        {days.map((day, index) => (
          <span key={day.localDate} className="flex shrink-0 items-stretch gap-2">
            {day.startsMonth ? (
              <span
                aria-hidden="true"
                className="flex w-5 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-ink-muted [writing-mode:vertical-rl] rotate-180"
              >
                {day.monthShort}
              </span>
            ) : null}
            <button
              ref={(node) => {
                dayRefs.current[index] = node;
              }}
              type="button"
              role="radio"
              aria-checked={index === selectedIndex}
              aria-label={day.label}
              tabIndex={index === selectedIndex ? 0 : -1}
              onClick={() => selectDay(index)}
              className={[
                "flex min-h-16 w-[60px] shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-xl border text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                index === selectedIndex
                  ? "border-ink bg-ink text-white"
                  : day.status === "closed"
                    ? "border-dashed border-line-strong bg-surface text-ink-subtle"
                    : day.status === "available"
                      ? "border-black/15 bg-surface text-ink hover:border-ink"
                      : "border-black/15 bg-surface text-ink-subtle",
              ].join(" ")}
            >
              <span className={`text-xs ${index === selectedIndex ? "text-white/80" : day.status === "available" ? "text-ink-muted" : ""}`}>
                {day.weekday}
              </span>
              <span
                className={`text-lg font-semibold tabular-nums ${
                  day.status === "full" || day.status === "short" ? "line-through decoration-1" : ""
                }`}
              >
                {day.day}
              </span>
            </button>
          </span>
        ))}
      </div>

      <section aria-labelledby="chosen-day" className="mt-5">
        <h2 id="chosen-day" className="text-base font-semibold tracking-tight">
          {selected.fullDate}
        </h2>

        {selected.status === "available" ? (
          groupSlotsByPartOfDay(selected.slots).map((group) => (
            <section key={group.part} aria-labelledby={`part-${group.part}`} className="mt-4">
              <h3 id={`part-${group.part}`} className="text-[13px] font-semibold text-ink-muted">
                {group.part}
              </h3>
              <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {group.slots.map((slot) => (
                  <li key={slot.start_at}>
                    <Link
                      href={checkoutHref({ username, treatmentId, addOnIds, startAt: slot.start_at })}
                      prefetch={false}
                      className="flex min-h-11 items-center justify-center rounded-[10px] border border-black/15 bg-surface text-sm font-semibold tabular-nums hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
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
              <p className="mt-1 text-sm text-ink-muted">There are no more times in the next 60 days.</p>
            )}
          </div>
        )}
      </section>
    </>
  );
}
