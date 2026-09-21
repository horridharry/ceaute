"use client";

import { useActionState, useMemo, useState } from "react";
import { keepFormValuesOnSubmit } from "@/lib/forms/keep-form-values";
import {
  DAYS_OF_WEEK,
  generateTimeOptions,
  getErrors,
  scheduleToState,
} from "../_lib/schedule-form";

export function WeeklyScheduleForm({ schedule, updateSchedule }) {
  const [stateMessage, updateScheduleAction, pending] = useActionState(
    updateSchedule,
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
    <form
      id="availability"
      className="mt-12 flex flex-col gap-4"
      action={updateScheduleAction}
      onSubmit={keepFormValuesOnSubmit(updateScheduleAction)}
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
              className="h-5 w-5 cursor-pointer appearance-none rounded border border-black/15 bg-white outline-none ring-2 ring-transparent duration-200 checked:border-transparent checked:bg-pink-600 hover:border-black/25 focus:ring-pink-100"
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
  );
}
