import assert from "node:assert/strict";
import test from "node:test";
import {
  weekdayNameToNumber,
  weekdayNumberToName,
} from "../src/app/(dashboard)/dashboard/availability/_lib/weekdays.js";

const DAYS = [
  ["monday", 1],
  ["tuesday", 2],
  ["wednesday", 3],
  ["thursday", 4],
  ["friday", 5],
  ["saturday", 6],
  ["sunday", 0],
];

test("converts every weekday name to its stored number", () => {
  for (const [name, number] of DAYS) {
    assert.equal(weekdayNameToNumber(name), number);
  }
});

test("converts every stored number back to its weekday name", () => {
  for (const [name, number] of DAYS) {
    assert.equal(weekdayNumberToName(number), name);
  }
});

test("returns null for unknown input in either direction", () => {
  assert.equal(weekdayNameToNumber("someday"), null);
  assert.equal(weekdayNameToNumber(undefined), null);
  assert.equal(weekdayNumberToName(7), null);
  assert.equal(weekdayNumberToName(undefined), null);
});
