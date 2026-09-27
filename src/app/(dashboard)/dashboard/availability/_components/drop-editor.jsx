"use client";

// Edits one drop, or makes a new one: tap dates, give the untimed ones their
// times together, change or remove single dates, choose the drop time, then
// one Save. The draft lives here until Save; customers see nothing of it.
// It is the whole of its own page (/dashboard/availability/new or
// /dashboard/availability/[dropId]/edit): a successful Save redirects to the
// list, and Cancel is a link back to it. Leaving with unsaved changes asks
// first. Nothing here asks for confirmation: removing a date or moving the
// drop time later never changes bookings already made.
import Link from "next/link";
import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useUnsavedChanges } from "@/components/unsaved-changes/use-unsaved-changes";
import { Button } from "@/components/ui/button";
import { buttonClassName } from "@/components/ui/button-classes";
import { FormActions } from "@/components/ui/form-actions";
import { FormError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PendingButton } from "@/components/ui/pending-button";
import { formatDateBookingsLine } from "../_lib/booking-messages";
import {
  DEFAULT_HOURS,
  TIMES_MESSAGE,
  dropBaseline,
  formatDateLabel,
  formatDateTimes,
  hasTimes,
  isDraftDirty,
  sortDates,
} from "../_lib/drop-form";
import { formatClockTime } from "@/lib/time/clock-time";
import { MonthGrid } from "./month-grid";
import { TimeInput } from "./time-input";

const UNTIMED = "untimed";

// Times for one or more dates: hours (one opening and one closing time) or
// a list of start times, never both. `initial` is a date's current times, or
// null to start from the usual 9 am to 5 pm.
function TimesPanel({ heading, initial, disabled, autoFocus, onApply, onCancel }) {
  const id = useId();
  const headingRef = useRef(null);
  const [kind, setKind] = useState(
    Array.isArray(initial?.start_times) ? "start_times" : "hours",
  );
  const [opens, setOpens] = useState(initial?.hours_start ?? DEFAULT_HOURS.hours_start);
  const [closes, setCloses] = useState(initial?.hours_end ?? DEFAULT_HOURS.hours_end);
  const [startTimes, setStartTimes] = useState(initial?.start_times ?? []);
  const [nextStart, setNextStart] = useState(DEFAULT_HOURS.hours_start);
  const [error, setError] = useState("");
  const startInputRef = useRef(null);

  useEffect(() => {
    if (autoFocus) headingRef.current?.focus();
  }, [autoFocus]);

  // Adds a typed or chosen start time and empties the field for the next.
  // Without a time yet (still "7", say), focus goes back to the field and its
  // suggestions.
  const addStartTime = (time) => {
    startInputRef.current?.focus();
    if (!time) return;
    setStartTimes((current) =>
      current.includes(time) ? current : [...current, time].sort(),
    );
    setNextStart("");
  };

  const apply = () => {
    if (kind === "hours") {
      if (!opens || !closes || closes <= opens) {
        setError(TIMES_MESSAGE);
        return;
      }
      onApply({ hours_start: opens, hours_end: closes, start_times: null });
      return;
    }

    if (startTimes.length > 0) {
      onApply({ hours_start: null, hours_end: null, start_times: startTimes });
    }
  };

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-3 rounded-xl border border-line p-4"
    >
      <h3
        id={`${id}-heading`}
        ref={headingRef}
        tabIndex={-1}
        className="text-base font-semibold outline-none"
      >
        {heading}
      </h3>

      <div role="radiogroup" aria-labelledby={`${id}-heading`} className="flex gap-4">
        {[
          { value: "hours", label: "Hours" },
          { value: "start_times", label: "Start times" },
        ].map((choice) => (
          <label
            key={choice.value}
            className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
          >
            <input
              type="radio"
              name={`${id}-kind`}
              value={choice.value}
              checked={kind === choice.value}
              disabled={disabled}
              onChange={() => {
                setKind(choice.value);
                setError("");
              }}
              className="h-5 w-5 accent-pink-700"
            />
            {choice.label}
          </label>
        ))}
      </div>

      {kind === "hours" ? (
        <div className="grid grid-cols-2 gap-2.5">
          <TimeInput
            id={`${id}-opens`}
            label="Opens"
            value={opens}
            disabled={disabled}
            className="min-w-0"
            onChange={(value) => {
              setOpens(value);
              setError("");
            }}
          />
          <TimeInput
            id={`${id}-closes`}
            label="Closes"
            value={closes}
            disabled={disabled}
            className="min-w-0"
            onChange={(value) => {
              setCloses(value);
              setError("");
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-2.5">
            <TimeInput
              id={`${id}-start`}
              label="Start time"
              value={nextStart}
              disabled={disabled}
              inputRef={startInputRef}
              className="min-w-0"
              onChange={setNextStart}
              onPick={addStartTime}
            />
            {/* Level with the field under its label, whatever shows below. */}
            <Button
              type="button"
              variant="secondary"
              className="mt-6.5 min-h-11 shrink-0"
              disabled={disabled}
              onClick={() => addStartTime(nextStart)}
            >
              Add time
            </Button>
          </div>
          {startTimes.length > 0 ? (
            <ul className="flex flex-col">
              {startTimes.map((time) => {
                const label = formatClockTime(time);

                return (
                  <li
                    key={time}
                    className="flex min-h-11 items-center gap-3 border-b border-line"
                  >
                    <span className="flex-1 text-sm tabular-nums">{label}</span>
                    <Button
                      type="button"
                      variant="text"
                      aria-label={`Remove ${label}`}
                      disabled={disabled}
                      onClick={() =>
                        setStartTimes((current) => current.filter((item) => item !== time))
                      }
                    >
                      Remove
                    </Button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}

      <FormError>{error}</FormError>

      <div className="flex flex-wrap justify-end gap-3">
        {onCancel ? (
          <Button
            type="button"
            variant="secondary"
            className="min-h-11"
            disabled={disabled}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          type="button"
          variant="primary"
          className="min-h-11"
          disabled={disabled || (kind === "start_times" && startTimes.length === 0)}
          onClick={apply}
        >
          Set times
        </Button>
      </div>
    </section>
  );
}

export function DropEditor({ drop, drops, countsByDate, today, now, saveDrop }) {
  const id = useId();
  const [baseline] = useState(() => dropBaseline(drop, now));
  const [draft, setDraft] = useState(baseline);
  // The one date whose times are being changed, or null.
  const [changing, setChanging] = useState(null);
  // The date whose Change times button gets focus once its panel closes.
  const [focusDate, setFocusDate] = useState(null);
  const draftRef = useRef(draft);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    if (!focusDate) return;
    document.getElementById(`${id}-change-${focusDate}`)?.focus();
  }, [focusDate, id]);

  // True from Submit until the save returns an error: the unsaved-changes
  // guard stands down so the redirect after a successful save is never
  // intercepted (the same idea as useFormUnsavedGuard).
  const [released, setReleased] = useState(false);
  const { allowNextNavigation } = useUnsavedChanges(
    isDraftDirty(draft, baseline) && !released,
  );

  const [result, formAction, pending] = useActionState(
    async (_previous, formData) => {
      const submitted = draftRef.current;
      // The server ignores the previous state, so none is sent. A successful
      // save redirects to the list and never returns here; reaching the next
      // line means it failed and the draft is still on screen, so protect it
      // again.
      const next = await saveDrop(null, formData);
      setReleased(false);

      return { ...next, submitted };
    },
    { status: "idle" },
  );

  // An error only stands while the draft is the one that failed to save.
  const showError = result.status === "error" && result.submitted === draft;

  const otherDropNames = Object.fromEntries(
    drops
      .filter((other) => other.id !== drop?.id)
      .flatMap((other) => other.dates.map((date) => [date.local_date, other.name])),
  );
  const selected = new Set(draft.dates.map((date) => date.local_date));
  const untimed = draft.dates.filter((date) => !hasTimes(date));
  const timed = draft.dates.filter(hasTimes);
  const changingDate = changing
    ? draft.dates.find((date) => date.local_date === changing) ?? null
    : null;

  const update = (changes) => setDraft((current) => ({ ...current, ...changes }));

  const toggleDate = (localDate) => {
    setFocusDate(null);
    if (changing === localDate) setChanging(null);
    setDraft((current) => ({
      ...current,
      dates: current.dates.some((date) => date.local_date === localDate)
        ? current.dates.filter((date) => date.local_date !== localDate)
        : sortDates([
            ...current.dates,
            { local_date: localDate, hours_start: null, hours_end: null, start_times: null },
          ]),
    }));
  };

  const removeDate = (localDate) => {
    setFocusDate(null);
    if (changing === localDate) setChanging(null);
    setDraft((current) => ({
      ...current,
      dates: current.dates.filter((date) => date.local_date !== localDate),
    }));
  };

  const applyTimes = (targets, times) => {
    const targetSet = new Set(targets);
    setDraft((current) => ({
      ...current,
      dates: current.dates.map((date) =>
        targetSet.has(date.local_date) ? { ...date, ...times } : date,
      ),
    }));
    setChanging(null);
    setFocusDate(targets[0] ?? null);
  };

  const panel = changingDate ? (
    <TimesPanel
      key={`change-${changingDate.local_date}`}
      heading={`Times for ${formatDateLabel(changingDate.local_date, today)}`}
      initial={changingDate}
      disabled={pending}
      autoFocus
      onApply={(times) => applyTimes([changingDate.local_date], times)}
      onCancel={() => {
        setChanging(null);
        setFocusDate(changingDate.local_date);
      }}
    />
  ) : untimed.length > 0 ? (
    <TimesPanel
      key={UNTIMED}
      heading={`Times for ${untimed.length} ${untimed.length === 1 ? "date" : "dates"}`}
      initial={null}
      disabled={pending}
      autoFocus={false}
      onApply={(times) => applyTimes(untimed.map((date) => date.local_date), times)}
    />
  ) : null;

  return (
    <div aria-busy={pending || undefined} className="flex flex-col gap-6">
      <MonthGrid
        today={today}
        initialMonth={(baseline.dates[0]?.local_date ?? today).slice(0, 7)}
        selected={selected}
        otherDropNames={otherDropNames}
        disabled={pending}
        onToggle={toggleDate}
      />

      {panel}

      {timed.length > 0 ? (
        <ul className="flex flex-col">
          {timed.map((date) => {
            const label = formatDateLabel(date.local_date, today);
            const bookingsLine = formatDateBookingsLine(countsByDate[date.local_date]);

            return (
              <li
                key={date.local_date}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-sm tabular-nums">{formatDateTimes(date)}</p>
                  {bookingsLine ? (
                    <p className="text-sm text-ink-muted">{bookingsLine}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    id={`${id}-change-${date.local_date}`}
                    type="button"
                    variant="text"
                    aria-label={`Change times for ${label}`}
                    disabled={pending}
                    onClick={() => {
                      setFocusDate(null);
                      setChanging(date.local_date);
                    }}
                  >
                    Change times
                  </Button>
                  <Button
                    type="button"
                    variant="text"
                    aria-label={`Remove ${label}`}
                    disabled={pending}
                    onClick={() => removeDate(date.local_date)}
                  >
                    Remove
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="label mb-1.5">Drop time</legend>
        <div className="flex gap-4">
          {[
            { value: "now", label: "Now" },
            { value: "later", label: "Later" },
          ].map((choice) => (
            <label
              key={choice.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"
            >
              <input
                type="radio"
                name={`${id}-drop-time`}
                value={choice.value}
                checked={draft.drop_time === choice.value}
                disabled={pending}
                onChange={() => update({ drop_time: choice.value })}
                className="h-5 w-5 accent-pink-700"
              />
              {choice.label}
            </label>
          ))}
        </div>
        {draft.drop_time === "later" ? (
          <div className="grid grid-cols-2 gap-2.5">
            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
              <label htmlFor={`${id}-opens-on`} className="label">
                Date
              </label>
              <Input
                id={`${id}-opens-on`}
                type="date"
                min={today}
                value={draft.opens_on}
                disabled={pending}
                onChange={(event) => update({ opens_on: event.target.value })}
                className="w-full min-w-0"
              />
            </span>
            <TimeInput
              id={`${id}-opens-time`}
              label="Time"
              value={draft.opens_time}
              disabled={pending}
              className="min-w-0"
              onChange={(value) => update({ opens_time: value })}
            />
          </div>
        ) : null}
      </fieldset>

      {/* Only hidden fields live in the form, so React's reset after the
          action never touches the controls above. */}
      <form
        action={formAction}
        onSubmit={() => {
          allowNextNavigation();
          setReleased(true);
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="drop_id" value={drop?.id ?? ""} />
        <input type="hidden" name="drop_time" value={draft.drop_time} />
        <input
          type="hidden"
          name="opens_on"
          value={draft.drop_time === "later" ? draft.opens_on : ""}
        />
        <input
          type="hidden"
          name="opens_time"
          value={draft.drop_time === "later" ? draft.opens_time : ""}
        />
        <input type="hidden" name="dates" value={JSON.stringify(draft.dates)} />

        <FormError>{showError ? result.message : ""}</FormError>
        <FormActions className="mt-0">
          <Link
            href="/dashboard/availability"
            className={buttonClassName({ variant: "secondary" })}
          >
            Cancel
          </Link>
          <PendingButton pendingLabel="Saving…" className="min-h-11">
            Save
          </PendingButton>
        </FormActions>
      </form>
    </div>
  );
}
