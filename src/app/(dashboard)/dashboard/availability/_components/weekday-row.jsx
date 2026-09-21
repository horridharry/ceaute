// One weekday in the Weekly hours editor: a summary header that opens and
// closes the row, and (when open) the editor for that day. Presentational:
// the draft lives in WeeklyScheduleForm.
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { formatDaySummary } from "../_lib/schedule-form";

export function WeekdayRow({
  day,
  label,
  isExpanded,
  isChanged,
  error,
  disabled,
  timeOptions,
  onToggleExpanded,
  onToggleOpen,
  onChangeTime,
}) {
  const dayOfWeek = day.dayOfWeek;
  const editorId = `${dayOfWeek}_editor`;
  const errorId = `${dayOfWeek}_hours_error`;
  const summary = formatDaySummary(day);

  return (
    <div className="border-b border-black/10">
      <button
        type="button"
        aria-expanded={isExpanded}
        aria-controls={editorId}
        disabled={disabled}
        onClick={onToggleExpanded}
        className="flex min-h-14 w-full scroll-mb-32 items-center gap-3 py-3 text-left disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex-1 text-sm font-medium">{label}</span>
        <span className="sr-only">, </span>
        {isChanged ? (
          <span
            aria-hidden="true"
            className="flex items-center gap-1.5 text-xs text-black/60"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-pink-700" />
            Not saved
          </span>
        ) : null}
        <span
          className={
            day.enabled
              ? "text-sm tabular-nums"
              : "text-sm tabular-nums text-black/60"
          }
        >
          {summary}
        </span>
        {isChanged ? <span className="sr-only">, not saved</span> : null}
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={
            isExpanded
              ? "h-4 w-4 shrink-0 rotate-180 text-black/60 motion-safe:transition-transform"
              : "h-4 w-4 shrink-0 text-black/60 motion-safe:transition-transform"
          }
        >
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isExpanded ? (
        <div id={editorId} className="pb-4">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <Checkbox
              checked={day.enabled}
              disabled={disabled}
              onChange={(event) => onToggleOpen(event.target.checked)}
            />
            Open on {label}
          </label>

          {day.enabled ? (
            <div className="mt-2 grid grid-cols-2 gap-2.5">
              <span className="field-set min-w-0">
                <label htmlFor={`${dayOfWeek}_starts_at`} className="label">
                  Opens
                </label>
                <Select
                  id={`${dayOfWeek}_starts_at`}
                  value={day.openTime}
                  disabled={disabled}
                  onChange={(event) =>
                    onChangeTime("openTime", event.target.value)
                  }
                  className="w-full min-w-0 scroll-mb-32"
                >
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </span>

              <span className="field-set min-w-0">
                <label htmlFor={`${dayOfWeek}_ends_at`} className="label">
                  Closes
                </label>
                <Select
                  id={`${dayOfWeek}_ends_at`}
                  value={day.closeTime}
                  disabled={disabled}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? errorId : undefined}
                  onChange={(event) =>
                    onChangeTime("closeTime", event.target.value)
                  }
                  className="w-full min-w-0 scroll-mb-32"
                >
                  {timeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                {error ? (
                  <p id={errorId} className="text-sm text-red-600">
                    {error}
                  </p>
                ) : null}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
