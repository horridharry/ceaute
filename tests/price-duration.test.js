import assert from "node:assert/strict";
import test from "node:test";
import {
  durationToMinutes,
  formatDurationMinutes,
  minutesToDuration,
  minutesToDurationParts,
  nonNegativePriceToPence,
  penceToPrice,
} from "../src/app/(dashboard)/dashboard/_lib/price-duration.js";

test("minutesToDuration renders a stored duration string", () => {
  assert.equal(minutesToDuration(90), "00:01:30");
  assert.equal(minutesToDuration(0), "00:00:00");
  assert.equal(minutesToDuration("not a number"), "00:00:00");
});

test("durationToMinutes reverses the duration string minutesToDuration produces", () => {
  assert.equal(durationToMinutes("00:01:30"), 90);
  assert.equal(durationToMinutes(150), 150);
  assert.equal(durationToMinutes("not a duration"), 0);
  assert.equal(durationToMinutes(null), 0);
  assert.equal(durationToMinutes(undefined), 0);
});

test("nonNegativePriceToPence accepts whole and fractional pounds, including zero", () => {
  assert.equal(nonNegativePriceToPence("12"), 1200);
  assert.equal(nonNegativePriceToPence("12.5"), 1250);
  assert.equal(nonNegativePriceToPence("12.50"), 1250);
  assert.equal(nonNegativePriceToPence("0"), 0);
});

test("nonNegativePriceToPence rejects text that is not a valid price", () => {
  assert.equal(nonNegativePriceToPence("abc"), null);
  assert.equal(nonNegativePriceToPence("-5"), null);
  assert.equal(nonNegativePriceToPence("12.999"), null);
  assert.equal(nonNegativePriceToPence(undefined), null);
});

test("penceToPrice converts pence to pounds and falls back to zero", () => {
  assert.equal(penceToPrice(1250), 12.5);
  assert.equal(penceToPrice("abc"), 0);
  assert.equal(penceToPrice(null), 0);
});

test("minutesToDurationParts splits minutes into hours and remaining minutes", () => {
  assert.deepEqual(minutesToDurationParts(90), { hours: 1, minutes: 30 });
  assert.deepEqual(minutesToDurationParts(0), { hours: 0, minutes: 0 });
  assert.deepEqual(minutesToDurationParts("not a number"), { hours: 0, minutes: 0 });
});

test("formatDurationMinutes joins whichever parts are present", () => {
  assert.equal(formatDurationMinutes(90), "1 hours 30 minutes");
  assert.equal(formatDurationMinutes(60), "1 hours");
  assert.equal(formatDurationMinutes(30), "30 minutes");
  assert.equal(formatDurationMinutes(0), "");
});
