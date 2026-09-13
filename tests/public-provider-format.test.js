import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateLabel,
  formatTimeLabel,
} from "../src/app/(public-provider)/[username]/_lib/public-provider-format.js";

test("formats winter appointments in Europe/London GMT", () => {
  const startAt = new Date("2026-01-15T10:00:00.000Z");

  assert.equal(formatTimeLabel(startAt), "10:00 am");
  assert.match(formatDateLabel(startAt), /15 Jan/);
});

test("formats September appointments in Europe/London BST", () => {
  const startAt = new Date("2026-09-15T09:00:00.000Z");
  const endAt = new Date("2026-09-15T10:00:00.000Z");

  assert.equal(formatTimeLabel(startAt), "10:00 am");
  assert.match(formatDateLabel(startAt), /15 Sept/);
  assert.equal(formatTimeLabel(endAt), "11:00 am");
});
