"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const generateTimeOptions = (intervalMinutes = 15) => {
  const timeOptions = [];

  for (let totalMinutes = 0; totalMinutes < 24 * 60; totalMinutes += intervalMinutes) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    const label = new Date(2000, 0, 1, hours, minutes).toLocaleTimeString(
      "en-GB",
      { hour: "numeric", minute: "2-digit", hour12: true },
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
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Availability</h1>
        <p className="mt-1 text-sm text-black/60">
          Set one continuous working period for each open day. Times are saved as
          Europe/London local times.
        </p>

        <form
          id="availability"
          className="mt-12 flex flex-col gap-4"
          action={updateScheduleAction}
        >
          {days.map((day, index) => (
            <div
              key={day.dayOfWeek}
              className={index === days.length - 1 ? "" : "border-b pb-4"}
            >
              <div className="flex items-center">
                <label
                  htmlFor={`${day.dayOfWeek}_enabled`}
                  className={
                    day.enabled
                      ? "flex-1 text-sm font-medium"
                      : "flex-1 text-sm text-black/60"
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
                  className="h-5 w-5 cursor-pointer appearance-none rounded border border-black/30 bg-white outline-none ring-1 ring-transparent duration-200 checked:border-transparent checked:bg-pink-600 hover:border-pink-600 hover:ring-pink-600"
                />
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
                        ? "mt-2 text-sm text-red-600 opacity-100 transition-opacity duration-500 ease-in"
                        : "mt-2 text-sm text-red-600 opacity-0 transition-opacity duration-500 ease-in"
                    }
                  >
                    {errors[day.dayOfWeek] || "Times are valid"}
                  </p>
                </div>
              ) : (
                <p className="pt-2 text-sm text-black/50">Closed</p>
              )}
            </div>
          ))}

          {stateMessage ? (
            <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          ) : null}

          <div className="mt-8 flex items-center justify-end gap-4">
            <Link
              href="/provider"
              className="w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Back
            </Link>
            <button
              form="availability"
              type="submit"
              disabled={pending || hasErrors}
              aria-disabled={pending || hasErrors}
              className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save hours"}
            </button>
          </div>
        </form>

        <section className="mt-12 flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Blocked dates
            </h2>
            <p className="mt-1 text-sm text-black/60">
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
            <button
              type="submit"
              disabled={blockDatePending}
              aria-disabled={blockDatePending}
              className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {blockDatePending ? "Blocking..." : "Block date"}
            </button>
          </form>

          {blockDateMessage ? (
            <p className="text-sm text-red-600">{blockDateMessage}</p>
          ) : null}

          {blockedDates.length ? (
            <ul className="flex flex-col gap-2">
              {blockedDates.map((blockedDate) => (
                <li
                  key={blockedDate.id}
                  className="flex items-center gap-3 rounded-lg border p-3"
                >
                  <p className="flex-1 text-sm font-medium">
                    {formatBlockedDate(blockedDate.local_date)}
                  </p>
                  <form action={removeBlockedDate}>
                    <input
                      type="hidden"
                      name="blocked_date_id"
                      value={blockedDate.id}
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-black/10 p-2 px-3 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
                    >
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-4 text-sm text-black/60">
              No upcoming blocked dates.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
