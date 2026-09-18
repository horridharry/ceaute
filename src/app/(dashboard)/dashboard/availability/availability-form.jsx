"use client";

import { useActionState, useMemo, useState } from "react";
import { APPOINTMENT_GRID_MINUTES } from "@/lib/bookings/appointment-grid";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import { PendingButton } from "@/components/pending-button";
import { Button } from "@/components/ui/button";

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

function formatBlockedDate(localDate) {
  const [year, month, day] = localDate.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
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
    <main className="mx-auto w-full max-w-[720px] px-5 py-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-display text-pretty text-ink">Working hours</h1>
        {/* The fixed product constants, stated once at the top rather than
            repeated beside every control. */}
        <p className="text-meta text-black/50">
          One block per day, on the quarter hour, in Europe/London. Customers
          book with 24 hours&rsquo; notice, up to 60 days ahead.
        </p>

        <form
          id="availability"
          className="mt-2 flex flex-col gap-4"
          action={updateScheduleAction}
          onSubmit={keepFormValuesOnSubmit(updateScheduleAction)}
        >
          {days.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className={index === days.length - 1 ? "" : "border-b border-black/8 pb-4"}
            >
              <div className="flex items-center">
                <label
                  htmlFor={`${day.dayOfWeek}_enabled`}
                  className={
                    day.enabled
                      ? "flex-1 cursor-pointer text-[14px] font-medium text-ink"
                      : "flex-1 cursor-pointer text-[14px] text-black/50"
                  }
                >
                  {DAYS_OF_WEEK[index].label}
                </label>
                <input
                  type="checkbox"
                  id={`${day.dayOfWeek}_enabled`}
                  name="enabled_weekday"
                  value={day.dayOfWeek}
                  checked={day.enabled}
                  onChange={() => toggleDay(day.dayOfWeek)}
                  className="peer sr-only"
                />
                <span className="relative block h-[22px] w-[38px] shrink-0 rounded-full bg-black/14 transition duration-150 ease-out peer-checked:bg-plum peer-checked:[&>span]:translate-x-4">
                  <span className="absolute left-0.5 top-0.5 block size-[18px] rounded-full bg-white transition duration-150 ease-out" />
                </span>
              </div>

              {day.enabled ? (
                <div className="pt-4">
                  <div className="flex gap-x-2.5">
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
                        onChange={(event) =>
                          updateTime(
                            day.dayOfWeek,
                            "openTime",
                            event.target.value,
                          )
                        }
                        className="field cursor-pointer"
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
                        onChange={(event) =>
                          updateTime(
                            day.dayOfWeek,
                            "closeTime",
                            event.target.value,
                          )
                        }
                        className="field cursor-pointer"
                      >
                        {timeOptions.map((timeOption) => (
                          <option key={timeOption.value} value={timeOption.value}>
                            {timeOption.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </div>
                  <p
                    className={
                      errors[day.dayOfWeek]
                        ? "mt-2 text-sm text-bad opacity-100 transition-opacity duration-500 ease-in"
                        : "mt-2 text-sm text-bad opacity-0 transition-opacity duration-500 ease-in"
                    }
                  >
                    {errors[day.dayOfWeek] || "Times are valid"}
                  </p>
                </div>
              ) : (
                <p className="pt-2 text-[13px] text-black/50">Closed</p>
              )}
            </div>
          ))}

          {stateMessage ? (
            <p className="mt-4 text-sm text-bad">{stateMessage}</p>
          ) : null}

          <div className="mt-4">
            <Button
              form="availability"
              type="submit"
              disabled={pending || hasErrors}
              aria-disabled={pending || hasErrors}
            >
              {pending ? "Saving…" : "Save hours"}
            </Button>
          </div>
        </form>

        <section className="mt-6 flex flex-col gap-3 border-t border-black/8 pt-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-heading text-pretty text-ink">Blocked dates</h2>
            <p className="text-[12.5px] text-black/60">
              Block a whole day for time off. This affects future availability
              and does not cancel existing bookings.
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
            <Button
              type="submit"
              variant="secondary"
              block={false}
              disabled={blockDatePending}
              aria-disabled={blockDatePending}
              className="shrink-0 px-5"
            >
              {blockDatePending ? "Blocking…" : "Block a date"}
            </Button>
          </form>

          {blockDateMessage ? (
            <p className="text-sm text-bad">{blockDateMessage}</p>
          ) : null}

          {blockedDates.length ? (
            <ul className="flex flex-col gap-2">
              {blockedDates.map((blockedDate) => (
                <li
                  key={blockedDate.id}
                  className="flex items-center gap-3 rounded-row border border-black/12 px-3.5 py-3"
                >
                  <p className="flex-1 text-[14px] font-medium text-ink">
                    {formatBlockedDate(blockedDate.local_date)}
                  </p>
                  <form action={removeBlockedDate}>
                    <input
                      type="hidden"
                      name="blocked_date_id"
                      value={blockedDate.id}
                    />
                    <PendingButton
                      pendingLabel="Removing..."
                      className="text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover disabled:opacity-40"
                    >
                      Remove
                    </PendingButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-black/60">
              No upcoming blocked dates.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
