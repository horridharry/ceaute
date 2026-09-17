import assert from "node:assert/strict";
import test from "node:test";
import { describeRouteError } from "../src/lib/errors/route-error.js";

test("a thrown database message is never shown to the user", () => {
  const error = new Error(
    'duplicate key value violates unique constraint "provider_page_username_unique"',
  );

  const copy = describeRouteError(error);

  assert.equal(copy.heading, "Something went wrong");
  assert.doesNotMatch(copy.message, /unique constraint/);
  assert.equal(copy.reference, null);
});

test("a server error digest is offered as a support reference", () => {
  const error = Object.assign(new Error("Could not load bookings."), {
    digest: " 1234567890 ",
  });

  assert.equal(describeRouteError(error).reference, "1234567890");
});

test("a missing error still produces usable copy", () => {
  const copy = describeRouteError(undefined);

  assert.ok(copy.heading);
  assert.ok(copy.message);
  assert.equal(copy.reference, null);
});
