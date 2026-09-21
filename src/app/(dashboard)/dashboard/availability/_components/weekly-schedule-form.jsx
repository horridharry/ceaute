"use client";

// The Weekly hours editor. Owns the saved week (baseline), the week being
// edited (draft), which rows are open, and the save lifecycle. Rows, the save
// bar and the closed-week dialog are presentational.
import {
  startTransition,
  useActionState,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useUnsavedChanges } from "@/components/unsaved-changes/use-unsaved-changes";
import {
  DAYS_OF_WEEK,
  generateTimeOptions,
  getChangedDays,
  getErrors,
  hasNoOpenDays,
  scheduleToFormData,
  scheduleToState,
} from "../_lib/schedule-form";
import { ClosedWeekDialog } from "./closed-week-dialog";
import { SaveHoursBar } from "./save-hours-bar";
import { WeekdayRow } from "./weekday-row";

const SAVED_FLASH_MS = 2000;

export function WeeklyScheduleForm({ schedule, updateSchedule, isPublished }) {
  // The editor doesn't reset from refreshed props after a save: the baseline
  // becomes exactly the week that was submitted.
  const [baseline, setBaseline] = useState(() => scheduleToState(schedule));
  const [draft, setDraft] = useState(baseline);
  const [expanded, setExpanded] = useState(() => new Set());
  const [closedWeekOpen, setClosedWeekOpen] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const submittedDraftRef = useRef(null);
  const headingRef = useRef(null);
  const saveButtonRef = useRef(null);
  const focusSaveOnDialogCloseRef = useRef(false);
  const headingId = useId();
  const timeOptions = useMemo(() => generateTimeOptions(), []);

  const [result, formAction, pending] = useActionState(
    async (_previous, formData) => {
      const submitted = submittedDraftRef.current;
      // The server ignores the previous state, so none is sent.
      const next = await updateSchedule(null, formData);

      if (next?.status === "saved") {
        startTransition(() => {
          setBaseline(submitted);
          setExpanded(new Set());
          setSavedAt(Date.now());
        });
      }

      return { ...next, submitted };
    },
    { status: "idle" },
  );

  const errors = getErrors(draft);
  const invalidDays = Object.keys(errors);
  const changedDays = getChangedDays(draft, baseline);
  const isDirty = changedDays.length > 0;
  // An error only stands while the draft is the one that failed to save.
  const showError = result.status === "error" && result.submitted === draft;

  const barStatus = pending
    ? "saving"
    : isDirty && showError
      ? "error"
      : isDirty && invalidDays.length > 0
        ? "invalid"
        : isDirty
          ? "dirty"
          : savedAt !== null
            ? "saved"
            : "hidden";

  useUnsavedChanges(isDirty);

  // After a save: focus the heading, then hide "Hours saved" after 2 seconds.
  useEffect(() => {
    if (savedAt === null) return undefined;
    headingRef.current?.focus();
    const timer = setTimeout(() => setSavedAt(null), SAVED_FLASH_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  // Saving disables every control, so a failed save can leave focus on the
  // page body. Put it back on Save hours for the retry.
  useEffect(() => {
    if (result.status !== "error") return;
    const active = document.activeElement;
    if (!active || active === document.body) {
      saveButtonRef.current?.focus();
    }
  }, [result]);

  // Keep editing returns focus to Save hours once the dialog has closed (the
  // dialog's own effect runs first and closes it).
  useEffect(() => {
    if (closedWeekOpen || !focusSaveOnDialogCloseRef.current) return;
    focusSaveOnDialogCloseRef.current = false;
    saveButtonRef.current?.focus();
  }, [closedWeekOpen]);

  const updateDay = (dayOfWeek, changes) => {
    setSavedAt(null);
    setDraft((current) =>
      current.map((day) =>
        day.dayOfWeek === dayOfWeek ? { ...day, ...changes } : day,
      ),
    );
  };

  const toggleExpanded = (dayOfWeek) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(dayOfWeek)) {
        next.delete(dayOfWeek);
      } else {
        next.add(dayOfWeek);
      }
      return next;
    });
  };

  const discard = () => {
    setDraft(baseline);
  };

  const showInvalid = () => {
    if (invalidDays.length === 0) return;
    flushSync(() => {
      setExpanded((current) => new Set([...current, ...invalidDays]));
    });
    document.getElementById(`${invalidDays[0]}_ends_at`)?.focus();
  };

  const submit = () => {
    submittedDraftRef.current = draft;
    startTransition(() => formAction(scheduleToFormData(draft)));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (pending || !isDirty || invalidDays.length > 0) return;

    if (isPublished && hasNoOpenDays(draft)) {
      setClosedWeekOpen(true);
      return;
    }

    submit();
  };

  const keepEditing = () => {
    focusSaveOnDialogCloseRef.current = true;
    setClosedWeekOpen(false);
  };

  const confirmClosedWeek = () => {
    setClosedWeekOpen(false);
    submit();
  };

  return (
    <section aria-labelledby={headingId} className="mt-10">
      <h2
        id={headingId}
        ref={headingRef}
        tabIndex={-1}
        className="text-xl font-semibold tracking-tight"
      >
        Weekly hours
      </h2>

      <form
        noValidate
        aria-busy={pending || undefined}
        onSubmit={handleSubmit}
        className="mt-2 flex flex-col"
      >
        {draft.map((day, index) => (
          <WeekdayRow
            key={day.dayOfWeek}
            day={day}
            label={DAYS_OF_WEEK[index].label}
            isExpanded={expanded.has(day.dayOfWeek)}
            isChanged={changedDays.includes(day.dayOfWeek)}
            error={errors[day.dayOfWeek] ?? ""}
            disabled={pending}
            timeOptions={timeOptions}
            onToggleExpanded={() => toggleExpanded(day.dayOfWeek)}
            onToggleOpen={(enabled) => updateDay(day.dayOfWeek, { enabled })}
            onChangeTime={(field, value) =>
              updateDay(day.dayOfWeek, { [field]: value })
            }
          />
        ))}

        {/* In normal flow (sticky, not fixed), so the bar takes up its own
            height after the last row and never covers it. */}
        <SaveHoursBar
          status={barStatus}
          changedCount={changedDays.length}
          invalidDays={invalidDays}
          errorMessage={result.message ?? ""}
          saveButtonRef={saveButtonRef}
          onDiscard={discard}
          onShowInvalid={showInvalid}
        />
      </form>

      <ClosedWeekDialog
        open={closedWeekOpen}
        onKeepEditing={keepEditing}
        onConfirm={confirmClosedWeek}
      />
    </section>
  );
}
