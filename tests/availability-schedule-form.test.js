import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBlockedDate,
  getErrors,
  scheduleToState,
} from "../src/app/(dashboard)/dashboard/availability/_lib/schedule-form.js";

test("scheduleToState fills every weekday with a disabled default when the schedule is empty", () => {
  assert.deepEqual(scheduleToState([]), [
    { dayOfWeek: "monday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "tuesday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "wednesday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "thursday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "friday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "saturday", openTime: "09:00", closeTime: "17:00", enabled: false },
    { dayOfWeek: "sunday", openTime: "09:00", closeTime: "17:00", enabled: false },
  ]);
});

test("scheduleToState enables only the days present in the schedule and truncates stored times to HH:MM", () => {
  const days = scheduleToState([
    { day_of_week: "monday", start_time: "09:00:00", end_time: "17:30:00" },
    { day_of_week: "friday", start_time: "10:15:00", end_time: "14:00:00" },
  ]);

  assert.deepEqual(
    days.find((day) => day.dayOfWeek === "monday"),
    { dayOfWeek: "monday", enabled: true, openTime: "09:00", closeTime: "17:30" },
  );
  assert.deepEqual(
    days.find((day) => day.dayOfWeek === "friday"),
    { dayOfWeek: "friday", enabled: true, openTime: "10:15", closeTime: "14:00" },
  );
  assert.deepEqual(
    days.find((day) => day.dayOfWeek === "tuesday"),
    { dayOfWeek: "tuesday", openTime: "09:00", closeTime: "17:00", enabled: false },
  );
});

test("getErrors returns nothing when every enabled day closes after it opens", () => {
  const days = [
    { dayOfWeek: "monday", enabled: true, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "tuesday", enabled: false, openTime: "09:00", closeTime: "17:00" },
  ];

  assert.deepEqual(getErrors(days), {});
});

test("getErrors flags an enabled day whose closing time is not after its opening time", () => {
  const days = [
    { dayOfWeek: "monday", enabled: true, openTime: "09:00", closeTime: "09:00" },
    { dayOfWeek: "tuesday", enabled: true, openTime: "17:00", closeTime: "09:00" },
  ];

  assert.deepEqual(getErrors(days), {
    monday: "Closing time must be after opening time.",
    tuesday: "Closing time must be after opening time.",
  });
});

test("getErrors ignores a disabled day even when its stored times are invalid", () => {
  const days = [
    { dayOfWeek: "monday", enabled: false, openTime: "17:00", closeTime: "09:00" },
  ];

  assert.deepEqual(getErrors(days), {});
});

test("getErrors does not compare times across different days (no cross-day overlap check)", () => {
  const days = [
    { dayOfWeek: "monday", enabled: true, openTime: "09:00", closeTime: "17:00" },
    { dayOfWeek: "tuesday", enabled: true, openTime: "08:00", closeTime: "16:00" },
  ];

  assert.deepEqual(getErrors(days), {});
});

test("formatBlockedDate formats a local date in Europe/London as a short weekday, day, month and year", () => {
  assert.equal(formatBlockedDate("2026-01-01"), "Thu, 1 Jan 2026");
  assert.equal(formatBlockedDate("2026-07-04"), "Sat, 4 Jul 2026");
});
