import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCheckoutPath,
  buildReturnPath,
  buildTimePath,
  firstSearchValue,
} from "../src/app/(public-provider)/[username]/book/[treatmentId]/checkout/_lib/checkout-paths.js";

test("firstSearchValue passes a scalar through unchanged", () => {
  assert.equal(firstSearchValue("abc"), "abc");
  assert.equal(firstSearchValue(undefined), undefined);
  assert.equal(firstSearchValue(""), "");
});

test("firstSearchValue takes the first entry of a search-param array", () => {
  assert.equal(firstSearchValue(["first", "second"]), "first");
  assert.equal(firstSearchValue([]), undefined);
});

test("buildCheckoutPath keeps add-ons in the order given, as repeated add_on params", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: ["b-id", "a-id"],
  });

  assert.equal(
    path,
    "/@jane/book/t1/checkout?start_at=2026-10-01T09%3A00%3A00.000Z&add_on=b-id&add_on=a-id",
  );
});

test("buildCheckoutPath with no add-ons and no preserved state omits every optional param", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: [],
  });

  assert.equal(
    path,
    "/@jane/book/t1/checkout?start_at=2026-10-01T09%3A00%3A00.000Z",
  );
});

test("buildCheckoutPath prefers state.hold over state.booking when both are set", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: [],
    state: { hold: "hold-1", booking: "booking-1" },
  });

  assert.match(path, /hold=hold-1/);
  assert.doesNotMatch(path, /booking-1/);
});

test("buildCheckoutPath falls back to state.booking only when state.hold is nullish", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: [],
    state: { booking: "booking-1" },
  });

  assert.match(path, /hold=booking-1/);
});

test("buildCheckoutPath reads array-valued search params through firstSearchValue", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: [],
    state: {
      hold: ["hold-1", "hold-2"],
      checkout: ["success"],
      session_id: ["sess_1"],
      next: ["/somewhere"],
      payment: ["expired"],
    },
  });
  const url = new URL(`https://example.com${path}`);

  assert.equal(url.searchParams.get("hold"), "hold-1");
  assert.equal(url.searchParams.get("checkout"), "success");
  assert.equal(url.searchParams.get("session_id"), "sess_1");
  assert.equal(url.searchParams.get("next"), "/somewhere");
  assert.equal(url.searchParams.get("payment"), "expired");
});

test("buildCheckoutPath drops falsy preserved values rather than writing them literally", () => {
  const path = buildCheckoutPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: [],
    state: { hold: "", checkout: 0, session_id: null, next: undefined },
  });

  assert.equal(
    path,
    "/@jane/book/t1/checkout?start_at=2026-10-01T09%3A00%3A00.000Z",
  );
});

test("buildReturnPath always sets hold, after the add-ons, regardless of value", () => {
  const path = buildReturnPath({
    username: "jane",
    treatmentId: "t1",
    startAt: "2026-10-01T09:00:00.000Z",
    addOnIds: ["a-id"],
    holdId: "hold-9",
  });

  assert.equal(
    path,
    "/@jane/book/t1/checkout?start_at=2026-10-01T09%3A00%3A00.000Z&add_on=a-id&hold=hold-9",
  );
});

test("buildTimePath omits the query string entirely when there are no add-ons", () => {
  const path = buildTimePath({
    username: "jane",
    treatmentId: "t1",
    addOnIds: [],
  });

  assert.equal(path, "/@jane/book/t1/time");
});

test("buildTimePath appends every add-on in order when there are some", () => {
  const path = buildTimePath({
    username: "jane",
    treatmentId: "t1",
    addOnIds: ["a-id", "b-id"],
  });

  assert.equal(path, "/@jane/book/t1/time?add_on=a-id&add_on=b-id");
});
