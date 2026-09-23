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

// Found in browser acceptance on 23 September 2026: a native input listener
// re-rendered a controlled field before its onChange ran and lost the first
// keystroke. The guard listens through React's own change events instead.
test("the form guard measures changes through React's change events, not native listeners", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync("src/components/unsaved-changes/use-form-unsaved-guard.js", "utf8");
  assert.doesNotMatch(source, /addEventListener\("(input|change)"/);
  assert.match(source, /formProps: \{ ref: formRef, onSubmit, onChange: measure, onReset \}/);
});
