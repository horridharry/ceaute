import assert from "node:assert/strict";
import test from "node:test";
import { isFocusedTaskRoute } from "../src/app/(dashboard)/dashboard/_lib/focused-task-routes.js";

test("a treatment, treatment group, add-on, or location create or edit route is focused", () => {
  assert.equal(isFocusedTaskRoute("/dashboard/treatments/new"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/treatments/abc123/edit"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/treatment-groups/new"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/treatment-groups/abc123/edit"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/add-ons/new"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/add-ons/abc123/edit"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/locations/new"), true);
  assert.equal(isFocusedTaskRoute("/dashboard/locations/abc123/edit"), true);
});

test("a list route or a non-matching route is not focused", () => {
  assert.equal(isFocusedTaskRoute("/dashboard/treatments"), false);
  assert.equal(isFocusedTaskRoute("/dashboard/treatment-groups"), false);
  assert.equal(isFocusedTaskRoute("/dashboard/add-ons"), false);
  assert.equal(isFocusedTaskRoute("/dashboard/locations"), false);
  assert.equal(isFocusedTaskRoute("/dashboard"), false);
  assert.equal(isFocusedTaskRoute("/dashboard/add-ons/abc123/edit/extra"), false);
});
