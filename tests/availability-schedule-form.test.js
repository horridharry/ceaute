import assert from "node:assert/strict";
import test from "node:test";
import {
  formatBlockedDate,
  formatChangedCount,
  formatClosedAnyway,
  formatDaySummary,
  formatInvalidMessage,
  formatSummaryTime,
  getChangedDays,
  getErrors,
  hasNoOpenDays,
  isBlockedDateOnClosedWeekday,
  isSameDay,
  parseSchedule,
  scheduleToFormData,
  scheduleToState,
} from "../src/app/(dashboard)/dashboard/availability/_lib/schedule-form.js";

const openDay = (dayOfWeek, openTime = "09:00", closeTime = "17:00") => ({
  dayOfWeek,
  enabled: true,
  openTime,
  closeTime,
});

const closedDay = (dayOfWeek, openTime = "09:00", closeTime = "17:00") => ({
  dayOfWeek,
  enabled: false,
  openTime,
  closeTime,
});

const formDataFrom = (entries) => {
  const formData = new FormData();

  for (const [name, value] of entries) {
    formData.append(name, value);
  }

  return formData;
};

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

test("formatBlockedDate leaves the year out when the date is in today's year", () => {
  assert.equal(formatBlockedDate("2026-10-03", "2026-09-21"), "Saturday 3 October");
  assert.equal(formatBlockedDate("2026-12-31", "2026-01-01"), "Thursday 31 December");
});

test("formatBlockedDate adds the year when the date is in another year", () => {
  assert.equal(formatBlockedDate("2027-01-02", "2026-09-21"), "Saturday 2 January 2027");
});

test("formatBlockedDate keeps the calendar day on UK clock-change dates", () => {
  assert.equal(formatBlockedDate("2026-03-29", "2026-01-01"), "Sunday 29 March");
  assert.equal(formatBlockedDate("2026-10-25", "2026-01-01"), "Sunday 25 October");
});

test("formatSummaryTime drops :00 on whole hours and uses lowercase am/pm", () => {
  assert.equal(formatSummaryTime("09:00"), "9 am");
  assert.equal(formatSummaryTime("19:30"), "7:30 pm");
  assert.equal(formatSummaryTime("12:00"), "12 pm");
  assert.equal(formatSummaryTime("17:00"), "5 pm");
  assert.equal(formatSummaryTime("00:00"), "12 am");
  assert.equal(formatSummaryTime("09:15"), "9:15 am");
});

test("formatDaySummary reads Closed or the opening range", () => {
  assert.equal(formatDaySummary(closedDay("monday")), "Closed");
  assert.equal(formatDaySummary(openDay("monday")), "9 am to 5 pm");
  assert.equal(formatDaySummary(openDay("monday", "10:00", "19:30")), "10 am to 7:30 pm");
});

test("isSameDay treats two closed days as the same whatever times they remember", () => {
  assert.equal(isSameDay(closedDay("monday"), closedDay("monday", "10:00", "12:00")), true);
});

test("isSameDay compares times only when both days are open", () => {
  assert.equal(isSameDay(openDay("monday"), openDay("monday")), true);
  assert.equal(isSameDay(openDay("monday"), openDay("monday", "09:00", "18:00")), false);
  assert.equal(isSameDay(openDay("monday"), openDay("monday", "08:00", "17:00")), false);
  assert.equal(isSameDay(openDay("monday"), closedDay("monday")), false);
  assert.equal(isSameDay(closedDay("monday"), openDay("monday")), false);
});

test("getChangedDays returns the changed days in week order", () => {
  const baseline = scheduleToState([
    { day_of_week: "monday", start_time: "09:00:00", end_time: "17:00:00" },
  ]);
  const draft = baseline.map((day) => {
    if (day.dayOfWeek === "sunday") return { ...day, enabled: true };
    if (day.dayOfWeek === "monday") return { ...day, closeTime: "18:00" };
    if (day.dayOfWeek === "wednesday") return { ...day, enabled: true };
    return day;
  });

  assert.deepEqual(getChangedDays(draft.toReversed(), baseline), [
    "monday",
    "wednesday",
    "sunday",
  ]);
});

test("getChangedDays counts ticking a day open and then closed again as unchanged", () => {
  const baseline = scheduleToState([]);
  const draft = baseline.map((day) =>
    day.dayOfWeek === "friday" ? { ...day, enabled: false, openTime: "10:00" } : day,
  );

  assert.deepEqual(getChangedDays(draft, baseline), []);
});

test("hasNoOpenDays is true only when every day is closed", () => {
  assert.equal(hasNoOpenDays(scheduleToState([])), true);
  assert.equal(
    hasNoOpenDays([closedDay("monday"), openDay("tuesday")]),
    false,
  );
});

test("formatChangedCount handles singular and plural", () => {
  assert.equal(formatChangedCount(1), "1 day changed");
  assert.equal(formatChangedCount(2), "2 days changed");
  assert.equal(formatChangedCount(7), "7 days changed");
});

test("formatInvalidMessage names a single day and counts several", () => {
  assert.equal(formatInvalidMessage(["friday"]), "Fix Friday's hours to save");
  assert.equal(
    formatInvalidMessage(["monday", "friday"]),
    "Fix the hours on 2 days to save",
  );
});

test("scheduleToFormData adds fields only for open days", () => {
  const formData = scheduleToFormData([
    openDay("monday", "09:00", "17:00"),
    closedDay("tuesday"),
    openDay("saturday", "10:15", "14:00"),
  ]);

  assert.deepEqual([...formData.entries()], [
    ["enabled_weekday", "monday"],
    ["monday_starts_at", "09:00"],
    ["monday_ends_at", "17:00"],
    ["enabled_weekday", "saturday"],
    ["saturday_starts_at", "10:15"],
    ["saturday_ends_at", "14:00"],
  ]);
});

test("scheduleToFormData round-trips through parseSchedule", () => {
  const days = scheduleToState([]).map((day) => {
    if (day.dayOfWeek === "monday") return openDay("monday", "09:00", "17:30");
    if (day.dayOfWeek === "sunday") return openDay("sunday", "10:15", "14:00");
    return { ...day, openTime: "07:00", closeTime: "06:00" };
  });

  assert.deepEqual(parseSchedule(scheduleToFormData(days)), {
    schedule: [
      { weekday: 1, starts_at: "09:00", ends_at: "17:30" },
      { weekday: 0, starts_at: "10:15", ends_at: "14:00" },
    ],
  });
});

test("scheduleToFormData round-trips a fully closed week to an empty schedule", () => {
  assert.deepEqual(parseSchedule(scheduleToFormData(scheduleToState([]))), {
    schedule: [],
  });
});

test("parseSchedule turns a valid week into weekday numbers", () => {
  const formData = formDataFrom([
    ["enabled_weekday", "Monday "],
    ["monday_starts_at", "09:00"],
    ["monday_ends_at", "17:00"],
    ["enabled_weekday", "saturday"],
    ["saturday_starts_at", " 08:45"],
    ["saturday_ends_at", "12:00"],
  ]);

  assert.deepEqual(parseSchedule(formData), {
    schedule: [
      { weekday: 1, starts_at: "09:00", ends_at: "17:00" },
      { weekday: 6, starts_at: "08:45", ends_at: "12:00" },
    ],
  });
});

test("parseSchedule rejects a weekday submitted twice", () => {
  const formData = formDataFrom([
    ["enabled_weekday", "monday"],
    ["enabled_weekday", "monday"],
    ["monday_starts_at", "09:00"],
    ["monday_ends_at", "17:00"],
  ]);

  assert.deepEqual(parseSchedule(formData), {
    error: "Each weekday can only be saved once.",
  });
});

test("parseSchedule rejects an unknown weekday", () => {
  const formData = formDataFrom([
    ["enabled_weekday", "someday"],
    ["someday_starts_at", "09:00"],
    ["someday_ends_at", "17:00"],
  ]);

  assert.deepEqual(parseSchedule(formData), { error: "Choose valid weekdays only." });
});

test("parseSchedule rejects missing or malformed times", () => {
  const formData = formDataFrom([
    ["enabled_weekday", "monday"],
    ["monday_starts_at", "9:00"],
    ["monday_ends_at", "17:00"],
  ]);

  assert.deepEqual(parseSchedule(formData), {
    error: "Choose valid opening and closing times.",
  });
});

test("parseSchedule rejects a time off the 15-minute grid", () => {
  const formData = formDataFrom([
    ["enabled_weekday", "monday"],
    ["monday_starts_at", "09:10"],
    ["monday_ends_at", "17:00"],
  ]);

  assert.deepEqual(parseSchedule(formData), {
    error:
      "Opening and closing times must be on 15-minute boundaries, such as 09:00 or 09:15.",
  });
});

test("parseSchedule rejects a closing time that is not after the opening time", () => {
  for (const closeTime of ["09:00", "08:00"]) {
    const formData = formDataFrom([
      ["enabled_weekday", "monday"],
      ["monday_starts_at", "09:00"],
      ["monday_ends_at", closeTime],
    ]);

    assert.deepEqual(parseSchedule(formData), {
      error: "Closing time must be after opening time.",
    });
  }
});

test("isBlockedDateOnClosedWeekday checks the date's weekday against the week", () => {
  const days = scheduleToState([
    { day_of_week: "saturday", start_time: "09:00:00", end_time: "17:00:00" },
  ]);

  assert.equal(isBlockedDateOnClosedWeekday("2026-10-03", days), false);
  assert.equal(isBlockedDateOnClosedWeekday("2026-09-23", days), true);
  assert.equal(isBlockedDateOnClosedWeekday("2026-10-25", days), true);
});

test("formatClosedAnyway names the date's weekday in the plural", () => {
  assert.equal(formatClosedAnyway("2026-09-23"), "You're closed on Wednesdays anyway");
  assert.equal(formatClosedAnyway("2026-03-29"), "You're closed on Sundays anyway");
});
