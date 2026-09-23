import assert from "node:assert/strict";
import test from "node:test";
import { formSnapshot, isFormChanged } from "../src/lib/forms/form-snapshot.js";

// Create and edit forms ask before leaving only when something differs from
// what they loaded with (approved 23 September 2026).
test("an untouched form is not changed", () => {
  const loaded = formSnapshot([["name", "French tips"], ["price", "71"]]);
  assert.equal(isFormChanged(loaded, formSnapshot([["name", "French tips"], ["price", "71"]])), false);
});

test("typing, then typing back to the original value, returns to unchanged", () => {
  const loaded = formSnapshot([["name", "French tips"]]);
  assert.equal(isFormChanged(loaded, formSnapshot([["name", "French tips!"]])), true);
  assert.equal(isFormChanged(loaded, formSnapshot([["name", "French tips"]])), false);
});

test("ticking or unticking a checkbox changes the form", () => {
  const loaded = formSnapshot([["treatment", "a"]]);
  assert.equal(isFormChanged(loaded, formSnapshot([["treatment", "a"], ["treatment", "b"]])), true);
  assert.equal(isFormChanged(loaded, formSnapshot([])), true);
});

test("a form whose starting values are not known yet is never reported as changed", () => {
  assert.equal(isFormChanged(null, formSnapshot([["name", "x"]])), false);
});

test("a chosen file counts as a change by name and size", () => {
  const loaded = formSnapshot([["photo", { name: "", size: 0 }]]);
  assert.equal(isFormChanged(loaded, formSnapshot([["photo", { name: "a.jpg", size: 1200 }]])), true);
});
