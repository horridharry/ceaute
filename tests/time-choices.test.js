import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { calculateAvailableAppointmentTimes } from "../src/app/(public-provider)/[username]/book/_lib/appointment-availability.js";
import {
  buildDayStrip,
  firstAvailableIndex,
  formatSlotTime,
  groupSlotsByPartOfDay,
  nextAvailableIndex,
  nextDropLine,
  nothingOpenMessage,
  dayStatusWord,
  monthRangeLabel,
  partOfDay,
  shortDateLabel,
  unavailableDayMessage,
} from "../src/app/(public-provider)/[username]/book/_lib/time-choices.js";

// "When suits you?" (Specification §9.1) with drops (decision 007): the strip
// holds only the dates the provider has opened; these helpers only shape the
// calculator's answer.

const componentsDir = new URL("../src/app/(public-provider)/[username]/book/_components/", import.meta.url);
const whenSuitsYouSource = readFileSync(new URL("when-suits-you.jsx", componentsDir), "utf8");
const reloadSource = readFileSync(new URL("reload-at-drop-time.jsx", componentsDir), "utf8");

test("each open day says why it has no times: fully booked, too short or inside the notice", () => {
  // Thursday 1 January 2026, open 09:00-10:00.
  const base = {
    now: new Date("2025-12-30T00:00:00.000Z"),
    openDates: [{ local_date: "2026-01-01", hours_start: "09:00:00", hours_end: "10:00:00", start_times: null }],
    appointments: [],
    durationMinutes: 30,
  };
  const reason = (date, input = {}) =>
    calculateAvailableAppointmentTimes({ ...base, ...input }).find((day) => day.local_date === date).unavailable_reason;

  assert.equal(reason("2026-01-01"), null, "a day with times has no reason");
  assert.equal(reason("2026-01-01", { durationMinutes: 90 }), "short");
  assert.equal(
    reason("2026-01-01", { appointments: [{ start_at: "2026-01-01T09:00:00.000Z", end_at: "2026-01-01T10:00:00.000Z" }] }),
    "full",
  );
  assert.equal(reason("2026-01-01", { now: new Date("2025-12-31T12:00:00.000Z") }), "notice");
  assert.equal(
    calculateAvailableAppointmentTimes(base).some((day) => day.local_date === "2026-01-02"),
    false,
    "a date that is not open is not in the strip at all",
  );
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
  { local_date: "2026-10-03", slots: [], unavailable_reason: "short" },
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
  assert.equal(days[2].label, "Saturday 3 October, no times");
  assert.equal(days[3].label, "Sunday 4 October");
  assert.equal(shortDateLabel(days[3]), "Sun 4 Oct");
  assert.ok(days.every((day) => day.status !== "closed" && !day.label.includes("closed")));
});

test("open dates all inside the notice stay in the strip as No times", () => {
  const days = buildDayStrip([
    { local_date: "2026-09-30", slots: [], unavailable_reason: "notice" },
    { local_date: "2026-10-01", slots: [], unavailable_reason: "notice" },
  ]);
  assert.deepEqual(
    days.map((day) => [day.localDate, dayStatusWord(day)]),
    [
      ["2026-09-30", "No times"],
      ["2026-10-01", "No times"],
    ],
  );
});

test("a day without times says which kind it is, with the next available day", () => {
  const days = buildDayStrip(dates);
  assert.equal(firstAvailableIndex(days), 0);
  assert.equal(nextAvailableIndex(days, 1), 3);
  assert.equal(nextAvailableIndex(days, 3), -1);
  assert.equal(unavailableDayMessage(days[1]), "Friday 2 October is fully booked.");
  assert.equal(
    unavailableDayMessage(days[2]),
    "There isn’t a long enough gap for this booking on Saturday 3 October.",
  );
  assert.equal(
    unavailableDayMessage({ status: "notice", fullDate: "Monday 5 October" }),
    "There are no times on Monday 5 October.",
  );
  assert.equal(buildDayStrip([{ local_date: "2026-09-30", slots: [], unavailable_reason: "notice" }]).length, 1);
});

test("when every open day is full, no day is available and the first is chosen", () => {
  const days = buildDayStrip([
    { local_date: "2026-10-02", slots: [], unavailable_reason: "full" },
    { local_date: "2026-10-03", slots: [], unavailable_reason: "full" },
  ]);
  assert.equal(firstAvailableIndex(days), -1);
  assert.deepEqual(days.map(dayStatusWord), ["Full", "Full"]);
});

// Approved 23 September 2026: the month is a heading above the day cards.
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

test("each unavailable day card says why in one word, and never 'Closed'", () => {
  const days = buildDayStrip(dates);
  assert.deepEqual(days.map(dayStatusWord), ["", "Full", "No times", ""]);
  assert.equal(dayStatusWord({ status: "short" }), "No times");
  assert.equal(dayStatusWord({ status: "notice" }), "No times");
  assert.equal(dayStatusWord({ status: "closed" }), "No times", "there is no closed word any more");
});

test("with nothing open, the screen says when the next drop opens, or that nothing is open", () => {
  assert.equal(
    // 18:00 UTC on 15 October is 7 pm in London (BST).
    nothingOpenMessage({ name: "November", opensAt: "2026-10-15T18:00:00.000Z" }),
    "No dates are open. November slots open on 15 October at 7 pm.",
  );
  assert.equal(nothingOpenMessage(null), "No dates are open for booking right now.");
  assert.equal(nothingOpenMessage(undefined), "No dates are open for booking right now.");
});

test("above a strip with no free start, the next drop line has no full stop", () => {
  assert.equal(
    // 19:00 UTC on 15 November is 7 pm in London (GMT).
    nextDropLine({ name: "December", opensAt: "2026-11-15T19:00:00.000Z" }),
    "December slots open on 15 November at 7 pm",
  );
  assert.equal(nextDropLine(null), "");
});

test("the booking screen has no window and no closed days", () => {
  assert.equal(whenSuitsYouSource.includes("in the next"), false);
  assert.equal(whenSuitsYouSource.includes("Closed"), false);
  assert.equal(whenSuitsYouSource.includes('"closed"'), false);
  assert.ok(whenSuitsYouSource.includes("There are no more times."));
  // Only an empty strip returns early; a strip of full days is still shown.
  assert.ok(whenSuitsYouSource.includes("if (days.length === 0) {"));
  assert.equal(whenSuitsYouSource.includes("days.length === 0 ||"), false);
  // Every next-drop sentence comes with the reload at the drop time.
  assert.equal(
    (whenSuitsYouSource.match(/<ReloadAtDropTime opensAt=\{nextDrop\.opensAt\} serverNow=\{serverNow\} \/>/g) ?? []).length,
    2,
  );
});

test("the screen reloads after the drop time, and keeps checking if it has already passed", () => {
  assert.ok(reloadSource.startsWith('"use client";'));
  assert.ok(reloadSource.includes("Date.parse(opensAt) - serverNow + AFTER_DROP_TIME_MS"));
  assert.ok(reloadSource.includes("const AFTER_DROP_TIME_MS = 2000;"));
  assert.ok(reloadSource.includes("const CHECK_AGAIN_MS = 5000;"));
  assert.ok(reloadSource.includes("const LONGEST_DELAY_MS = 2_000_000_000;"));
  assert.ok(reloadSource.includes("delay > 0 ? delay : CHECK_AGAIN_MS"), "a passed drop time checks again in 5 s");
  assert.ok(reloadSource.includes("router.refresh()"));
  assert.ok(reloadSource.includes("clearTimeout(timer)"));
  assert.ok(reloadSource.includes("return null;"));
});

// The redesign is presentation only: the strip and its times are exactly the
// calculator's, so the 24-hour notice and the 15-minute start grid (mirrored
// from ceaute.create_validated_booking_hold) hold, with no 60-day window.
test("the strip shows exactly the calculator's days and times", () => {
  const now = new Date("2026-09-23T16:00:00.000Z"); // 17:00 in London
  const openDates = Array.from({ length: 130 }, (_, index) => {
    const date = new Date(Date.UTC(2026, 8, 23 + index, 12));
    return {
      local_date: date.toISOString().slice(0, 10),
      hours_start: "09:00:00",
      hours_end: "20:00:00",
      start_times: null,
    };
  });
  const availableDates = calculateAvailableAppointmentTimes({
    now,
    openDates,
    appointments: [],
    durationMinutes: 180,
  });
  const days = buildDayStrip(availableDates);

  // Notice: nothing before 17:00 tomorrow; the strip starts on the first day
  // with a time outside the notice.
  assert.equal(days[0].localDate, "2026-09-24");
  assert.deepEqual(days[0].slots.map((slot) => formatSlotTime(slot.local_time)), ["17:00"]);

  // No window: the last open date is offered, 129 days after today.
  assert.equal(days.at(-1).localDate, "2027-01-30");
  assert.equal(days.at(-1).status, "available");

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
