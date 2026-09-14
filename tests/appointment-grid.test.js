import assert from "node:assert/strict";
import test from "node:test";
import { isOnAppointmentGrid } from "../src/lib/bookings/appointment-grid.js";

test("accepts working periods whose boundaries are on the 15-minute grid", () => {
  for (const [startsAt, endsAt] of [
    ["09:00", "17:00"],
    ["09:15", "17:45"],
  ]) {
    assert.equal(isOnAppointmentGrid(startsAt) && isOnAppointmentGrid(endsAt), true);
  }
});

test("rejects working periods with an off-grid opening or closing time", () => {
  for (const [startsAt, endsAt] of [
    ["09:07", "17:00"],
    ["09:00", "17:07"],
  ]) {
    assert.equal(isOnAppointmentGrid(startsAt) && isOnAppointmentGrid(endsAt), false);
  }
});

test("reads times stored by PostgreSQL with seconds", () => {
  assert.equal(isOnAppointmentGrid("09:45:00"), true);
  assert.equal(isOnAppointmentGrid("10:41:00"), false);
});

test("rejects values that are not times", () => {
  assert.equal(isOnAppointmentGrid(""), false);
  assert.equal(isOnAppointmentGrid(undefined), false);
});
