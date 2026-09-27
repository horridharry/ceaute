import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_TIME_SUGGESTIONS,
  QUARTER_HOUR_MESSAGE,
  TIME_TEXT_MESSAGE,
  readTimeText,
  timeTextError,
} from "../src/app/(dashboard)/dashboard/availability/_lib/time-text.js";
import { formatClockTime } from "../src/lib/time/clock-time.js";

const labels = (text) => readTimeText(text).suggestions.map(formatClockTime);

test("readTimeText understands the ways a provider writes 7 pm", () => {
  for (const text of ["7pm", "7 pm", "7PM", "7 Pm", "7p", "7 p.m.", "19:00", "19.00", "1900", "19", " 19 "]) {
    const reading = readTimeText(text);
    assert.equal(reading.kind, "time", text);
    assert.equal(reading.value, "19:00", text);
  }
});

test("readTimeText understands minutes written with a colon, a dot or none", () => {
  for (const text of ["7:30pm", "7:30 pm", "7.30 pm", "7.30PM", "730pm", "19:30", "19.30", "1930"]) {
    assert.equal(readTimeText(text).value, "19:30", text);
  }
  assert.equal(readTimeText("0730").value, "07:30");
  assert.equal(readTimeText("07:30").value, "07:30");
  assert.equal(readTimeText("9:45am").value, "09:45");
  assert.equal(readTimeText("9:45 a.m.").value, "09:45");
});

test("readTimeText reads 12 am as midnight and 12 pm as noon", () => {
  assert.equal(readTimeText("12am").value, "00:00");
  assert.equal(readTimeText("12:15 am").value, "00:15");
  assert.equal(readTimeText("12pm").value, "12:00");
  assert.equal(readTimeText("12:45 pm").value, "12:45");
  assert.equal(readTimeText("0").value, "00:00");
  assert.equal(readTimeText("00:00").value, "00:00");
  assert.equal(readTimeText("23:45").value, "23:45");
});

test("an hour without am or pm suggests both, morning first, then its quarter hours", () => {
  const reading = readTimeText("7");
  assert.equal(reading.kind, "ambiguous");
  assert.equal(reading.value, "");
  assert.deepEqual(labels("7"), ["7 am", "7 pm", "7:15 am", "7:15 pm", "7:30 am", "7:30 pm"]);
  assert.equal(reading.suggestions.length, MAX_TIME_SUGGESTIONS);
});

test("12 without am or pm suggests noon first, then midnight", () => {
  assert.equal(readTimeText("12").kind, "ambiguous");
  assert.deepEqual(labels("12").slice(0, 2), ["12 pm", "12 am"]);
  assert.deepEqual(labels("1200").slice(0, 2), ["12 pm", "12 am"]);
});

test("minutes without am or pm are still ambiguous", () => {
  assert.equal(readTimeText("7:30").kind, "ambiguous");
  assert.deepEqual(labels("7:30"), ["7:30 am", "7:30 pm"]);
  assert.deepEqual(labels("730"), ["7:30 am", "7:30 pm"]);
  assert.deepEqual(labels("10:15"), ["10:15 am", "10:15 pm"]);
});

test("an unambiguous 24-hour hour suggests that hour and its quarter hours", () => {
  assert.deepEqual(labels("19"), ["7 pm", "7:15 pm", "7:30 pm", "7:45 pm"]);
  assert.deepEqual(labels("7pm"), ["7 pm", "7:15 pm", "7:30 pm", "7:45 pm"]);
  assert.deepEqual(labels("19:00"), ["7 pm"]);
});

test("minutes being typed suggest the quarter hours they could become", () => {
  assert.equal(readTimeText("7:").kind, "partial");
  assert.deepEqual(labels("7:").slice(0, 2), ["7:15 am", "7:15 pm"]);
  assert.equal(readTimeText("7:").suggestions.length, MAX_TIME_SUGGESTIONS);
  assert.deepEqual(labels("7:1"), ["7:15 am", "7:15 pm"]);
  assert.deepEqual(labels("7.3"), ["7:30 am", "7:30 pm"]);
  assert.deepEqual(labels("7:0"), ["7 am", "7 pm"]);
  assert.deepEqual(labels("19:4"), ["7:45 pm"]);
  assert.equal(readTimeText("7:1").value, "");
});

test("typing 1900 suggests 7 pm before the last digit", () => {
  assert.equal(readTimeText("190").kind, "partial");
  assert.deepEqual(labels("190"), ["7 pm"]);
});

test("a time off the quarter hour is refused, not rounded", () => {
  for (const text of ["7:10 pm", "7:10", "19:05", "1910", "7:5", "7:59am"]) {
    const reading = readTimeText(text);
    assert.equal(reading.kind, "off-quarter", text);
    assert.equal(reading.value, "", text);
    assert.deepEqual(reading.suggestions, [], text);
    assert.equal(timeTextError(reading), QUARTER_HOUR_MESSAGE, text);
  }
});

test("text that can't be a time is refused", () => {
  for (const text of ["abc", "25", "24:00", "7:60", "13pm", "0am", "12345", "7:30:00", ":30", "pm", "7xm", "123:00"]) {
    const reading = readTimeText(text);
    assert.equal(reading.kind, "invalid", text);
    assert.equal(reading.value, "", text);
    assert.deepEqual(reading.suggestions, [], text);
    assert.equal(timeTextError(reading), TIME_TEXT_MESSAGE, text);
  }
});

test("empty text is neither a time nor an error", () => {
  for (const text of ["", "   ", null, undefined]) {
    const reading = readTimeText(text);
    assert.equal(reading.kind, "empty");
    assert.equal(reading.value, "");
    assert.deepEqual(reading.suggestions, []);
    assert.equal(timeTextError(reading), "");
  }
});

test("times, ambiguous hours and minutes being typed carry no error", () => {
  for (const text of ["7 pm", "7", "7:", "12"]) {
    assert.equal(timeTextError(readTimeText(text)), "", text);
  }
});

test("every suggestion is an on-the-quarter 'HH:MM' value", () => {
  for (const text of ["1", "7", "12", "19", "0", "7:", "7:1", "9am", "11:3", "190"]) {
    for (const value of readTimeText(text).suggestions) {
      assert.match(value, /^([01]\d|2[0-3]):(00|15|30|45)$/, `${text} → ${value}`);
    }
  }
});

test("the messages use the app's time wording and no em dashes", () => {
  assert.equal(TIME_TEXT_MESSAGE, "Type a time, like 7 pm or 19:00.");
  assert.equal(QUARTER_HOUR_MESSAGE, "Use a time on the quarter hour, like 7:15 pm.");
  assert.doesNotMatch(TIME_TEXT_MESSAGE + QUARTER_HOUR_MESSAGE, /—/);
});
