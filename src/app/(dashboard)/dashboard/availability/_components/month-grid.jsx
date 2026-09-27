"use client";

// One month of dates to tap, Monday first. Each date is a toggle: pressed
// when it is in the drop being edited. Dates before today, and dates already
// in another drop, can't be chosen. Dates are 'YYYY-MM-DD' London dates, so
// the calendar is plain date arithmetic in UTC with no time zone involved.
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { formatDateLabel } from "../_lib/drop-form";

const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const pad = (value) => String(value).padStart(2, "0");

// 'YYYY-MM' plus a number of months.
function addMonths(yearMonth, count) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + count, 1));

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}

function monthHeading(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

// The month's dates, preceded by nulls so the 1st falls on its weekday.
function monthCells(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1));
  const leading = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: days }, (_, index) => `${yearMonth}-${pad(index + 1)}`),
  ];
}

export function MonthGrid({
  today,
  initialMonth,
  selected,
  otherDropNames,
  disabled = false,
  onToggle,
}) {
  const firstMonth = today.slice(0, 7);
  const [month, setMonth] = useState(() =>
    initialMonth && initialMonth > firstMonth ? initialMonth : firstMonth,
  );
  const headingId = useId();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Previous month"
          disabled={disabled || month <= firstMonth}
          onClick={() => setMonth((current) => addMonths(current, -1))}
        >
          <span aria-hidden="true">‹</span>
        </Button>
        <h3
          id={headingId}
          aria-live="polite"
          className="flex-1 text-center text-base font-semibold"
        >
          {monthHeading(month)}
        </h3>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Next month"
          disabled={disabled}
          onClick={() => setMonth((current) => addMonths(current, 1))}
        >
          <span aria-hidden="true">›</span>
        </Button>
      </div>

      <div
        role="group"
        aria-labelledby={headingId}
        className="grid grid-cols-7 gap-1"
      >
        {WEEKDAY_LETTERS.map((letter, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="text-center text-xs text-ink-muted"
          >
            {letter}
          </span>
        ))}
        {monthCells(month).map((localDate, index) => {
          if (!localDate) {
            return <span key={`blank-${index}`} aria-hidden="true" />;
          }

          const otherName = otherDropNames[localDate] ?? "";
          const isPast = localDate < today;
          const isPressed = selected.has(localDate);
          const label = `${formatDateLabel(localDate, today)}${
            otherName ? `, in ${otherName}` : ""
          }`;

          return (
            <button
              key={localDate}
              type="button"
              aria-pressed={isPressed}
              aria-label={label}
              disabled={disabled || isPast || Boolean(otherName)}
              onClick={() => onToggle(localDate)}
              className={
                isPressed
                  ? "min-h-11 rounded-lg bg-action text-sm font-semibold text-white tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
                  : otherName
                    ? "min-h-11 rounded-lg bg-surface-subtle text-sm text-ink-muted tabular-nums disabled:cursor-not-allowed"
                    : "min-h-11 rounded-lg border border-line text-sm tabular-nums hover:bg-surface-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:border-transparent disabled:text-ink-subtle"
              }
            >
              {Number(localDate.slice(8, 10))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
