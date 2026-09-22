import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { composeClassName } from "../src/components/ui/class-names.js";

// The ui primitives are thin: their only logic is composing their own base
// classes with a caller's className, which is what composeClassName does and
// what these tests cover. Whether each primitive renders is proved by
// `npm run build` once a screen uses one; `node --test` has no JSX transform
// and this task does not add one.

const SERVER_PRIMITIVES = [
  "button",
  "input",
  "select",
  "textarea",
  "checkbox",
  "field",
];

function primitiveSource(name) {
  return readFileSync(
    new URL(`../src/components/ui/${name}.jsx`, import.meta.url),
    "utf8",
  );
}

test("a caller's className is appended, never replaced", () => {
  assert.equal(composeClassName("field", "mt-4"), "field mt-4");
  assert.equal(
    composeClassName("field cursor-pointer", "w-full"),
    "field cursor-pointer w-full",
  );
});

test("a primitive keeps its own classes when the caller passes none", () => {
  assert.equal(composeClassName("h-4 w-4", undefined), "h-4 w-4");
  assert.equal(composeClassName("h-4 w-4", ""), "h-4 w-4");
  assert.equal(composeClassName("h-4 w-4", null), "h-4 w-4");
});

test("the base classes always come first so a caller can override them", () => {
  assert.ok(composeClassName("p-3", "p-6").startsWith("p-3"));
  assert.equal(composeClassName("p-3", "p-6"), "p-3 p-6");
});

test("every primitive except PendingButton is a Server Component", () => {
  for (const name of SERVER_PRIMITIVES) {
    assert.ok(
      !primitiveSource(name).includes('"use client"'),
      `${name}.jsx must not opt into the client bundle`,
    );
  }

  // PendingButton is the one exception: it needs useFormStatus.
  assert.ok(primitiveSource("pending-button").startsWith('"use client"'));
});

// Field wraps a control with a label and an error line instead of styling a
// native element itself, so it takes an explicit prop list like the existing
// FormField does rather than spreading the rest.
const NATIVE_ELEMENT_PRIMITIVES = SERVER_PRIMITIVES.filter(
  (name) => name !== "field",
);

test("every primitive forwards native props and the caller's className", () => {
  for (const name of [...NATIVE_ELEMENT_PRIMITIVES, "pending-button"]) {
    const source = primitiveSource(name);

    assert.ok(
      source.includes("...rest") || source.includes("...buttonProps"),
      `${name}.jsx must forward native element props`,
    );
  }

  // Button composes through buttonClassName, which buttons and button-styled
  // links share (tested in design-system-primitives.test.js).
  for (const name of SERVER_PRIMITIVES) {
    assert.ok(
      /composeClassName|buttonClassName/.test(primitiveSource(name)),
      `${name}.jsx must compose className rather than replace it`,
    );
  }
});
