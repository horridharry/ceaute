import Link from "next/link";

// Five days, never seven — reviewers consistently read a full week as too much
// at once. A closed day stays in place at 35% opacity: it is never struck
// through and never hidden, because a gap in the row reads as a bug.
export function DayStrip({
  monthLabel,
  previousHref,
  nextHref,
  onPrevious,
  onNext,
  days = [],
  value,
  onSelect,
  className = "",
}) {
  const stepClassName =
    "grid size-7 place-items-center rounded-full border border-black/12 text-[13px] text-ink transition duration-150 ease-out hover:border-black/30 disabled:opacity-30";

  return (
    <div className={`flex flex-col gap-2 ${className}`.trim()}>
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-medium text-ink">{monthLabel}</span>
        <div className="flex items-center gap-2">
          {previousHref ? (
            <Link href={previousHref} aria-label="Previous days" className={stepClassName}>
              ‹
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Previous days"
              onClick={onPrevious}
              disabled={!onPrevious}
              className={stepClassName}
            >
              ‹
            </button>
          )}
          {nextHref ? (
            <Link href={nextHref} aria-label="Next days" className={stepClassName}>
              ›
            </Link>
          ) : (
            <button
              type="button"
              aria-label="Next days"
              onClick={onNext}
              disabled={!onNext}
              className={stepClassName}
            >
              ›
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        {days.map((day) => {
          const selected = day.value === value;
          const cellClassName = `flex flex-1 flex-col items-center gap-0.5 rounded-control py-[11px] transition duration-150 ease-out ${
            selected ? "bg-ink text-white" : "border border-black/12 text-ink"
          } ${day.closed ? "opacity-35" : ""}`;

          const content = (
            <>
              <span
                className={`text-[11px] font-medium ${
                  selected ? "text-white/70" : "text-black/50"
                }`}
              >
                {day.weekdayLabel}
              </span>
              <span className="text-[17px] font-semibold">{day.dayLabel}</span>
            </>
          );

          if (day.href && !day.closed) {
            return (
              <Link
                key={day.value}
                href={day.href}
                aria-current={selected ? "date" : undefined}
                className={cellClassName}
              >
                {content}
              </Link>
            );
          }

          return (
            <button
              key={day.value}
              type="button"
              disabled={day.closed}
              aria-pressed={selected}
              onClick={() => onSelect?.(day.value)}
              className={cellClassName}
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
