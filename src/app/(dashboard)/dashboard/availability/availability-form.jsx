"use client";

import { useActionState, useMemo, useState } from "react";
import { APPOINTMENT_GRID_MINUTES } from "@/lib/bookings/appointment-grid";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { PendingButton } from "@/components/pending-button";
import { PageSectionNav } from "../_components/page-section-nav";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const generateTimeOptions = (intervalMinutes = APPOINTMENT_GRID_MINUTES) => {
  const timeOptions = [];

  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += intervalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const label = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
      "en-GB",
      { hour: "numeric", minute: "2-digit", hourCycle: "h12" },
    );

    timeOptions.push({ value, label });
  }

  return timeOptions;
};

const defaultDay = (dayOfWeek) => ({
  dayOfWeek,
  openTime: "09:00",
  closeTime: "17:00",
});

function scheduleToState(schedule) {
  return DAYS_OF_WEEK.map(({ value }) => {
    const daySchedule = schedule.find((entry) => entry.day_of_week === value);

    if (!daySchedule) {
      return {
        ...defaultDay(value),
        enabled: false,
      };
    }

    return {
      dayOfWeek: value,
      enabled: true,
      openTime: String(daySchedule.start_time).slice(0, 5),
      closeTime: String(daySchedule.end_time).slice(0, 5),
    };
  });
}

function getErrors(days) {
  return Object.fromEntries(
    days
      .filter((day) => day.enabled && day.closeTime <= day.openTime)
      .map((day) => [day.dayOfWeek, "Closing time must be after opening time."]),
  );
}

// One chip per date, so the label has to be short. The schema stores single
// blocked dates, so a week off is seven chips and there is no range to show.
function formatBlockedDate(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/London",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function AvailabilityForm({
  schedule,
  blockedDates,
  updateSchedule,
  blockDate,
  removeBlockedDate,
}) {
  const [stateMessage, updateScheduleAction, pending] = useActionState(
    updateSchedule,
    "",
  );
  const [blockDateMessage, blockDateAction, blockDatePending] = useActionState(
    blockDate,
    "",
  );
  const [days, setDays] = useState(() => scheduleToState(schedule));
  // One row open at a time: the editor appears in place, under the row tapped.
  const [openDayOfWeek, setOpenDayOfWeek] = useState(null);
  const timeOptions = useMemo(() => generateTimeOptions(), []);
  const errors = getErrors(days);
  const hasErrors = Object.keys(errors).length > 0;

  const updateDay = (dayOfWeek, updater) => {
    setDays((currentDays) =>
      currentDays.map((day) =>
        day.dayOfWeek === dayOfWeek ? updater(day) : day,
      ),
    );
  };

  const toggleDay = (dayOfWeek) => {
    updateDay(dayOfWeek, (day) => ({ ...day, enabled: !day.enabled }));
  };

  const updateTime = (dayOfWeek, field, value) => {
    updateDay(dayOfWeek, (day) => ({ ...day, [field]: value }));
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <PageSectionNav />

        <form
          id="availability"
          className="mt-8 flex flex-col"
          action={updateScheduleAction}
          onSubmit={keepFormValuesOnSubmit(updateScheduleAction)}
        >
          {days.map((day, index) => {
            const label = DAYS_OF_WEEK[index].label;
            const isOpen = openDayOfWeek === day.dayOfWeek;
            const openLabel = timeOptions.find(
              (option) => option.value === day.openTime,
            )?.label;
            const closeLabel = timeOptions.find(
              (option) => option.value === day.closeTime,
            )?.label;

            return (
              <div
                key={day.dayOfWeek}
                className="border-b border-black/8 last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenDayOfWeek(isOpen ? null : day.dayOfWeek)
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
                >
                  <span className="text-sm font-medium">{label}</span>
                  {day.enabled ? (
                    <span className="text-sm font-medium tabular-nums text-accent-600">
                      {openLabel} &ndash; {closeLabel}
                    </span>
                  ) : (
                    <span className="text-sm text-black/45">Closed</span>
                  )}
                </button>

                {/* Always mounted so a collapsed row still submits its times;
                    `hidden` keeps the controls in the form either way. */}
                <div hidden={!isOpen} className="pb-4">
                  <label
                    htmlFor={`${day.dayOfWeek}_enabled`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      id={`${day.dayOfWeek}_enabled`}
                      name="enabled_weekday"
                      value={day.dayOfWeek}
                      checked={day.enabled}
                      onChange={() => toggleDay(day.dayOfWeek)}
                      className="h-5 w-5 cursor-pointer appearance-none rounded border border-black/15 bg-white outline-none duration-200 checked:border-transparent checked:bg-accent-600 hover:border-black/25"
                    />
                    Open on {label}
                  </label>

                  <div className="mt-3 flex gap-x-2.5">
                    <span className="field-set flex-1">
                      <label
                        htmlFor={`${day.dayOfWeek}_starts_at`}
                        className="label"
                      >
                        Opens
                      </label>
                      <select
                        id={`${day.dayOfWeek}_starts_at`}
                        name={`${day.dayOfWeek}_starts_at`}
                        value={day.openTime}
                        disabled={!day.enabled}
                        onChange={(event) =>
                          updateTime(
                            day.dayOfWeek,
                            "openTime",
                            event.target.value,
                          )
                        }
                        className="field cursor-pointer disabled:opacity-40"
                      >
                        {timeOptions.map((timeOption) => (
                          <option key={timeOption.value} value={timeOption.value}>
                            {timeOption.label}
                          </option>
                        ))}
                      </select>
                    </span>

                    <span className="field-set flex-1">
                      <label
                        htmlFor={`${day.dayOfWeek}_ends_at`}
                        className="label"
                      >
                        Closes
                      </label>
                      <select
                        id={`${day.dayOfWeek}_ends_at`}
                        name={`${day.dayOfWeek}_ends_at`}
                        value={day.closeTime}
                        disabled={!day.enabled}
                        onChange={(event) =>
                          updateTime(
                            day.dayOfWeek,
                            "closeTime",
                            event.target.value,
                          )
                        }
                        className="field cursor-pointer disabled:opacity-40"
                      >
                        {timeOptions.map((timeOption) => (
                          <option key={timeOption.value} value={timeOption.value}>
                            {timeOption.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </div>

                  {errors[day.dayOfWeek] ? (
                    <p className="mt-2 text-sm text-bad">
                      {errors[day.dayOfWeek]}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {stateMessage ? (
            <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-4">
            <button
              form="availability"
              type="submit"
              disabled={pending || hasErrors}
              aria-disabled={pending || hasErrors}
              className="w-max rounded-lg bg-accent-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-accent-700 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save hours"}
            </button>
          </div>
        </form>

        <section className="mt-12 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
              Days off
            </p>
            <p className="mt-1 text-sm text-black/60">
              Existing bookings are not cancelled.
            </p>
          </div>

          <form action={blockDateAction} className="flex items-end gap-3">
            <span className="field-set flex-1">
              <label className="label" htmlFor="local_date">
                Date
              </label>
              <input
                id="local_date"
                name="local_date"
                type="date"
                className="field"
              />
            </span>
            <button
              type="submit"
              disabled={blockDatePending}
              aria-disabled={blockDatePending}
              className="w-max rounded-[10px] bg-accent-600 p-3 px-4 text-sm font-medium text-white duration-200 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {blockDatePending ? "Adding..." : "Add"}
            </button>
          </form>

          {blockDateMessage ? (
            <p className="text-sm text-bad">{blockDateMessage}</p>
          ) : null}

          {blockedDates.length ? (
            <ul className="flex flex-wrap gap-2">
              {blockedDates.map((blockedDate) => (
                <li key={blockedDate.id}>
                  <form action={removeBlockedDate}>
                    <input
                      type="hidden"
                      name="blocked_date_id"
                      value={blockedDate.id}
                    />
                    <PendingButton
                      pendingLabel="Removing..."
                      className="inline-flex items-center gap-1.5 rounded-full border border-black/12 py-1.5 pr-2.5 pl-3 text-sm tabular-nums duration-200 hover:border-black/25 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {formatBlockedDate(blockedDate.local_date)}
                      <span aria-hidden="true" className="text-black/45">
                        &times;
                      </span>
                      <span className="sr-only">Remove</span>
                    </PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-black/55">No days off coming up.</p>
          )}
        </section>
      </div>
    </main>
  );
}
