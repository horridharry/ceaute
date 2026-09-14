import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableAppointmentTimes,
  localDateTimeToInstant,
} from "../src/app/(public-provider)/[username]/book/_lib/appointment-availability.js";

const baseInput = {
  now: new Date("2025-12-30T00:00:00.000Z"),
  availabilityRules: [{ weekday: 4, starts_at: "09:00", ends_at: "10:00" }],
  blockedDates: [],
  appointments: [],
  durationMinutes: 30,
};

function slotsFor(date, input = {}) {
  return calculateAvailableAppointmentTimes({
    ...baseInput,
    ...input,
  }).find((day) => day.local_date === date).slots;
}

test("generates starts every 15 minutes", () => {
  assert.deepEqual(
    slotsFor("2026-01-01").map((slot) => slot.local_time),
    ["09:00", "09:15", "09:30"],
  );
});

test("does not allow an appointment to run beyond closing", () => {
  assert.deepEqual(
    slotsFor("2026-01-01", { durationMinutes: 45 }).map(
      (slot) => slot.local_time,
    ),
    ["09:00", "09:15"],
  );
});

test("includes selected add-on duration in the appointment length", () => {
  assert.deepEqual(
    slotsFor("2026-01-01", { durationMinutes: 60 }).map(
      (slot) => slot.local_time,
    ),
    ["09:00"],
  );
});

test("excludes blocked dates", () => {
  assert.equal(
    slotsFor("2026-01-01", { blockedDates: ["2026-01-01"] }).length,
    0,
  );
});

test("enforces the 24-hour minimum notice", () => {
  assert.deepEqual(
    slotsFor("2026-01-02", {
      now: new Date("2026-01-01T09:15:00.000Z"),
      availabilityRules: [{ weekday: 5, starts_at: "09:00", ends_at: "10:00" }],
    }).map((slot) => slot.local_time),
    ["09:15", "09:30"],
  );
});

test("enforces the 60-day booking window", () => {
  const result = calculateAvailableAppointmentTimes({
    ...baseInput,
    now: new Date("2026-01-01T00:00:00.000Z"),
  });

  assert.equal(result.at(-1).local_date, "2026-03-02");
  assert.equal(result.some((day) => day.local_date === "2026-03-03"), false);
});

test("offers starts through the 60th London calendar day and none after it", () => {
  const result = calculateAvailableAppointmentTimes({
    ...baseInput,
    // 23:30 UTC is already 1 July in London, matching PostgreSQL's local date.
    now: new Date("2026-06-30T23:30:00.000Z"),
    availabilityRules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      weekday,
      starts_at: "09:00",
      ends_at: "10:00",
    })),
  });

  assert.equal(result[0].local_date, "2026-07-01");
  assert.equal(result.at(-1).local_date, "2026-08-30");
  assert.deepEqual(
    result.at(-1).slots.map((slot) => slot.local_time),
    ["09:00", "09:15", "09:30"],
  );
});

test("keeps starts on the 15-minute grid for durations off the grid", () => {
  assert.deepEqual(
    slotsFor("2026-01-01", { durationMinutes: 20 }).map(
      (slot) => slot.local_time,
    ),
    ["09:00", "09:15", "09:30"],
  );
  assert.deepEqual(
    slotsFor("2026-01-01", { durationMinutes: 35 }).map(
      (slot) => slot.local_time,
    ),
    ["09:00", "09:15"],
  );
});

test("excludes starts that overlap active appointments", () => {
  assert.deepEqual(
    slotsFor("2026-01-01", {
      appointments: [
        {
          start_at: "2026-01-01T09:15:00.000Z",
          end_at: "2026-01-01T09:45:00.000Z",
        },
      ],
    }).map((slot) => slot.local_time),
    [],
  );
});

test("converts UK spring daylight-saving local times safely", () => {
  assert.equal(
    localDateTimeToInstant({
      localDate: "2026-03-29",
      localTime: "02:00",
    }).toISOString(),
    "2026-03-29T01:00:00.000Z",
  );
  assert.equal(
    localDateTimeToInstant({
      localDate: "2026-03-29",
      localTime: "01:30",
    }),
    null,
  );
});

test("converts UK autumn daylight-saving local times safely", () => {
  assert.equal(
    localDateTimeToInstant({
      localDate: "2026-10-25",
      localTime: "02:00",
    }).toISOString(),
    "2026-10-25T02:00:00.000Z",
  );
});
