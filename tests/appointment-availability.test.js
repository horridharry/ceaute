import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateAvailableAppointmentTimes,
  localDateTimeToInstant,
} from "../src/app/(public-provider)/[username]/book/_lib/appointment-availability.js";

// The calculator mirrors ceaute.create_validated_booking_hold (202609270001):
// starts only on open dates (get_public_open_dates rows), inside a date's
// hours or at its start times, 24 hours ahead, ending the day they start.

// Tuesday 30 December 2025, 00:00 in London (GMT).
const NOW = new Date("2025-12-30T00:00:00.000Z");

function hours(localDate, hoursStart, hoursEnd) {
  return { local_date: localDate, hours_start: hoursStart, hours_end: hoursEnd, start_times: null };
}

function startTimes(localDate, times) {
  return { local_date: localDate, hours_start: null, hours_end: null, start_times: times };
}

const baseInput = {
  now: NOW,
  openDates: [hours("2026-01-01", "09:00:00", "10:00:00")],
  appointments: [],
  durationMinutes: 30,
};

function dayFor(date, input = {}) {
  return calculateAvailableAppointmentTimes({ ...baseInput, ...input }).find(
    (day) => day.local_date === date,
  );
}

function timesFor(date, input = {}) {
  return dayFor(date, input).slots.map((slot) => slot.local_time);
}

test("an hours date offers every 15-minute start the booking fits in", () => {
  assert.deepEqual(timesFor("2026-01-01"), ["09:00", "09:15", "09:30"]);
  assert.deepEqual(timesFor("2026-01-01", { durationMinutes: 45 }), ["09:00", "09:15"]);
  assert.deepEqual(timesFor("2026-01-01", { durationMinutes: 60 }), ["09:00"], "add-on minutes count");
  assert.equal(dayFor("2026-01-01").slots[0].start_at, "2026-01-01T09:00:00.000Z");
});

test("starts stay on the 15-minute grid for durations off the grid", () => {
  assert.deepEqual(timesFor("2026-01-01", { durationMinutes: 20 }), ["09:00", "09:15", "09:30"]);
  assert.deepEqual(timesFor("2026-01-01", { durationMinutes: 35 }), ["09:00", "09:15"]);
});

test("a start-times date offers only its listed starts that end the same day", () => {
  const openDates = [startTimes("2026-01-01", ["10:00:00", "12:00:00", "23:30:00"])];

  // 23:30 plus an hour ends after midnight, which the hold refuses.
  assert.deepEqual(timesFor("2026-01-01", { openDates, durationMinutes: 60 }), ["10:00", "12:00"]);
  // Ending exactly at midnight is the next day too.
  assert.deepEqual(timesFor("2026-01-01", { openDates, durationMinutes: 30 }), ["10:00", "12:00"]);
  assert.deepEqual(
    timesFor("2026-01-01", { openDates, durationMinutes: 29 }),
    ["10:00", "12:00", "23:30"],
  );
  // Any treatment may begin at a listed start, however long, if it ends that day.
  assert.deepEqual(timesFor("2026-01-01", { openDates, durationMinutes: 300 }), ["10:00", "12:00"]);
});

test("an hours date never offers a start that ends after midnight", () => {
  assert.deepEqual(
    timesFor("2026-01-01", {
      openDates: [hours("2026-01-01", "23:00:00", "23:45:00")],
      durationMinutes: 30,
    }),
    ["23:00", "23:15"],
  );
});

test("a booking that runs into a later start removes that start", () => {
  const openDates = [startTimes("2026-01-01", ["10:00:00", "12:00:00", "15:00:00"])];

  assert.deepEqual(
    timesFor("2026-01-01", {
      openDates,
      durationMinutes: 60,
      appointments: [{ start_at: "2026-01-01T10:00:00.000Z", end_at: "2026-01-01T12:30:00.000Z" }],
    }),
    ["15:00"],
  );
});

test("starts that overlap an active appointment are left out", () => {
  assert.deepEqual(
    timesFor("2026-01-01", {
      appointments: [{ start_at: "2026-01-01T09:15:00.000Z", end_at: "2026-01-01T09:45:00.000Z" }],
    }),
    [],
  );
});

test("the 24 hours' notice removes early starts and marks a date inside it 'notice'", () => {
  assert.deepEqual(
    timesFor("2026-01-02", {
      now: new Date("2026-01-01T09:15:00.000Z"),
      openDates: [hours("2026-01-02", "09:00:00", "10:00:00")],
    }),
    ["09:15", "09:30"],
  );
  assert.equal(
    dayFor("2026-01-01", { now: new Date("2025-12-31T12:00:00.000Z") }).unavailable_reason,
    "notice",
  );
});

test("a date the booking fits at no start is 'short'", () => {
  assert.equal(dayFor("2026-01-01", { durationMinutes: 90 }).unavailable_reason, "short");
  assert.equal(
    dayFor("2026-01-01", {
      openDates: [startTimes("2026-01-01", ["23:30:00"])],
      durationMinutes: 60,
    }).unavailable_reason,
    "short",
  );
});

test("a fully booked date is 'full', and a date with times has no reason", () => {
  assert.equal(dayFor("2026-01-01").unavailable_reason, null);
  assert.equal(
    dayFor("2026-01-01", {
      appointments: [{ start_at: "2026-01-01T09:00:00.000Z", end_at: "2026-01-01T10:00:00.000Z" }],
    }).unavailable_reason,
    "full",
  );
});

test("there is no booking window: a date 120 days ahead is offered", () => {
  // 1 May 2026 is 120 days after 1 January, in British Summer Time.
  const day = dayFor("2026-05-01", {
    now: new Date("2026-01-01T00:00:00.000Z"),
    openDates: [hours("2026-05-01", "09:00:00", "10:00:00")],
  });

  assert.deepEqual(day.slots.map((slot) => slot.local_time), ["09:00", "09:15", "09:30"]);
  assert.equal(day.slots[0].start_at, "2026-05-01T08:00:00.000Z");
});

test("only open dates appear, in date order, from London today on", () => {
  const result = calculateAvailableAppointmentTimes({
    ...baseInput,
    // 23:30 UTC on 30 June is already 1 July in London, matching PostgreSQL.
    now: new Date("2026-06-30T23:30:00.000Z"),
    openDates: [
      hours("2026-07-10", "09:00:00", "10:00:00"),
      hours("2026-06-30", "09:00:00", "10:00:00"),
      startTimes("2026-07-03", ["11:00:00"]),
      hours("2026-07-01", "09:00:00", "10:00:00"),
    ],
  });

  assert.deepEqual(
    result.map((day) => day.local_date),
    ["2026-07-01", "2026-07-03", "2026-07-10"],
  );
  assert.ok(
    result.every((day) => day.unavailable_reason === null || ["short", "notice", "full"].includes(day.unavailable_reason)),
    "no date is ever 'closed'",
  );
  assert.deepEqual(calculateAvailableAppointmentTimes({ ...baseInput, openDates: [] }), []);
});

test("a start that does not exist on the spring clock change is skipped", () => {
  assert.deepEqual(
    timesFor("2026-03-29", {
      now: new Date("2026-03-20T00:00:00.000Z"),
      openDates: [hours("2026-03-29", "00:30:00", "02:30:00")],
      durationMinutes: 15,
    }),
    ["00:30", "00:45", "02:00", "02:15"],
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
