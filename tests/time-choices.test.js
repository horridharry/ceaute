import assert from "node:assert/strict";
import test from "node:test";
import { calculateAvailableAppointmentTimes } from "../src/app/(public-provider)/[username]/book/_lib/appointment-availability.js";
import {
  buildDayStrip,
  firstAvailableIndex,
  formatSlotTime,
  groupSlotsByPartOfDay,
  nextAvailableIndex,
  dayStatusWord,
  monthRangeLabel,
  partOfDay,
  shortDateLabel,
  unavailableDayMessage,
} from "../src/app/(public-provider)/[username]/book/_lib/time-choices.js";

// "When suits you?" (Specification §9.1): the calculator is unchanged; these
// only shape its answer.

test("each day says why it has no times: closed, fully booked, too short or inside the notice", () => {
  // Thursday 1 January 2026, 09:00–10:00; Friday closed.
  const base = {
    now: new Date("2025-12-30T00:00:00.000Z"),
    availabilityRules: [{ weekday: 4, starts_at: "09:00", ends_at: "10:00" }],
    blockedDates: [],
    appointments: [],
    durationMinutes: 30,
  };
  const reason = (date, input = {}) =>
    calculateAvailableAppointmentTimes({ ...base, ...input }).find((day) => day.local_date === date).unavailable_reason;

  assert.equal(reason("2026-01-01"), null, "a day with times has no reason");
  assert.equal(reason("2026-01-02"), "closed");
  assert.equal(reason("2026-01-01", { blockedDates: ["2026-01-01"] }), "closed", "a blocked date reads as closed");
  assert.equal(reason("2026-01-01", { durationMinutes: 90 }), "short");
  assert.equal(
    reason("2026-01-01", { appointments: [{ start_at: "2026-01-01T09:00:00.000Z", end_at: "2026-01-01T10:00:00.000Z" }] }),
    "full",
  );
  assert.equal(reason("2026-01-01", { now: new Date("2025-12-31T12:00:00.000Z") }), "notice");
});

test("times fall into Morning, Afternoon and Evening at noon and 5 pm", () => {
  assert.equal(partOfDay("11:45"), "Morning");
  assert.equal(partOfDay("12:00"), "Afternoon");
  assert.equal(partOfDay("16:45"), "Afternoon");
  assert.equal(partOfDay("17:00"), "Evening");
  assert.deepEqual(
    groupSlotsByPartOfDay([{ local_time: "09:00" }, { local_time: "17:30" }]).map((group) => group.part),
    ["Morning", "Evening"],
    "a part of the day with no times is left out",
  );
});

// Approved 23 September 2026: 24-hour times with two-digit hours.
test("times read in 24-hour form", () => {
  assert.equal(formatSlotTime("09:15"), "09:15");
  assert.equal(formatSlotTime("9:15"), "09:15");
  assert.equal(formatSlotTime("12:00"), "12:00");
  assert.equal(formatSlotTime("17:30"), "17:30");
  assert.equal(formatSlotTime("00:00"), "00:00");
});

const dates = [
  { local_date: "2026-09-30", slots: [], unavailable_reason: "notice" },
  { local_date: "2026-10-01", slots: [{ local_time: "10:00", start_at: "2026-10-01T09:00:00.000Z" }], unavailable_reason: null },
  { local_date: "2026-10-02", slots: [], unavailable_reason: "full" },
  { local_date: "2026-10-03", slots: [], unavailable_reason: "closed" },
  { local_date: "2026-10-04", slots: [{ local_time: "14:00", start_at: "2026-10-04T13:00:00.000Z" }], unavailable_reason: null },
];

test("the strip starts after the notice period and labels each day for screen readers", () => {
  const days = buildDayStrip(dates);
  assert.equal(days[0].localDate, "2026-10-01", "today, inside the notice, does not lead the strip");
  assert.deepEqual(
    days.map((day) => `${day.weekday} ${day.day}`),
    ["Thu 1", "Fri 2", "Sat 3", "Sun 4"],
  );
  assert.equal(days[1].label, "Friday 2 October, fully booked");
  assert.equal(days[2].label, "Saturday 3 October, closed");
  assert.equal(days[3].label, "Sunday 4 October");
  assert.equal(shortDateLabel(days[3]), "Sun 4 Oct");
});

test("a day without times says which kind it is, with the next available day", () => {
  const days = buildDayStrip(dates);
  assert.equal(firstAvailableIndex(days), 0);
  assert.equal(nextAvailableIndex(days, 1), 3);
  assert.equal(nextAvailableIndex(days, 3), -1);
  assert.equal(unavailableDayMessage(days[1], "Studio Nala"), "Friday 2 October is fully booked.");
  assert.equal(unavailableDayMessage(days[2], "Studio Nala"), "Studio Nala isn’t working on Saturday 3 October.");
  assert.equal(buildDayStrip([{ local_date: "2026-09-30", slots: [], unavailable_reason: "notice" }]).length, 0);
});

// Approved 23 September 2026: the month is a heading above the day cards, and
// a closed day and a fully booked day say so in words on their cards.
test("the month heading names the months of the cards in view", () => {
  const days = buildDayStrip([
    { local_date: "2026-09-29", slots: [{ local_time: "10:00", start_at: "x" }], unavailable_reason: null },
    { local_date: "2026-09-30", slots: [{ local_time: "10:00", start_at: "y" }], unavailable_reason: null },
    { local_date: "2026-10-01", slots: [{ local_time: "10:00", start_at: "z" }], unavailable_reason: null },
  ]);
  assert.equal(monthRangeLabel(days, 0, 1), "September");
  assert.equal(monthRangeLabel(days, 0, 2), "September – October");
  assert.equal(monthRangeLabel(days, 2, 2), "October");
  assert.equal(monthRangeLabel([], 0, 0), "");
});

test("each unavailable day card says why in one word", () => {
  const days = buildDayStrip(dates);
  assert.deepEqual(days.map(dayStatusWord), ["", "Full", "Closed", ""]);
  assert.equal(dayStatusWord({ status: "short" }), "No times");
});

// The redesign is presentation only: the strip and its times are exactly the
// calculator's, so the 24-hour notice, the 60-day window and the 15-minute
// start grid (all mirrored from ceaute.create_validated_booking_hold) hold.
test("the strip shows exactly the calculator's days and times", () => {
  const now = new Date("2026-09-23T16:00:00.000Z"); // 17:00 in London
  const availableDates = calculateAvailableAppointmentTimes({
    now,
    availabilityRules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, starts_at: "09:00", ends_at: "20:00" })),
    blockedDates: [],
    appointments: [],
    durationMinutes: 180,
  });
  const days = buildDayStrip(availableDates);

  // Notice: nothing before 17:00 tomorrow; the strip starts on the first day
  // with a time outside the notice.
  assert.equal(days[0].localDate, "2026-09-24");
  assert.deepEqual(days[0].slots.map((slot) => formatSlotTime(slot.local_time)), ["17:00"]);

  // Window: the last day offered is the 60th after today, and no later.
  assert.equal(days.at(-1).localDate, "2026-11-22");
  assert.equal(availableDates.some((date) => date.local_date > "2026-11-22"), false);

  // Grid: every start is on a quarter hour, and a full day runs 09:00-17:00.
  const full = days[1].slots.map((slot) => slot.local_time);
  assert.equal(full[0], "09:00");
  assert.equal(full.at(-1), "17:00");
  assert.ok(full.every((time) => Number(time.slice(3)) % 15 === 0));
  assert.equal(full.length, 33);

  // Every calculator slot appears once, unchanged, in the grouped view.
  for (const day of days) {
    const grouped = groupSlotsByPartOfDay(day.slots).flatMap((group) => group.slots);
    assert.deepEqual(grouped.map((slot) => slot.start_at).sort(), day.slots.map((slot) => slot.start_at).sort());
  }
});
