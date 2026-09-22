import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_PAGINATION_DOTS,
  paginationDots,
} from "../src/features/storefront/hero-pagination.js";

const describe = (dots) =>
  dots.map(({ index, size }) => `${index}${size === "active" ? "*" : size === "small" ? "s" : ""}`).join(" ");

test("no dots for zero or one image", () => {
  assert.deepEqual(paginationDots({ count: 0, current: 0 }), []);
  assert.deepEqual(paginationDots({ count: 1, current: 0 }), []);
});

test("up to five images get one dot each, with the current one active", () => {
  assert.equal(describe(paginationDots({ count: 2, current: 1 })), "0 1*");
  assert.equal(describe(paginationDots({ count: 5, current: 2 })), "0 1 2* 3 4");
});

test("more than five images show a window of five that follows the current image", () => {
  assert.equal(describe(paginationDots({ count: 12, current: 0 })), "0* 1 2 3 4s");
  assert.equal(describe(paginationDots({ count: 12, current: 2 })), "0 1 2* 3 4s");
  assert.equal(describe(paginationDots({ count: 12, current: 3 })), "1s 2 3* 4 5s");
  assert.equal(describe(paginationDots({ count: 12, current: 10 })), "7s 8 9 10* 11");
  assert.equal(describe(paginationDots({ count: 12, current: 11 })), "7s 8 9 10 11*");
});

test("the row never exceeds five dots and always contains the current image", () => {
  for (let count = 2; count <= 60; count += 1) {
    for (let current = 0; current < count; current += 1) {
      const dots = paginationDots({ count, current });
      assert.ok(dots.length <= MAX_PAGINATION_DOTS);
      assert.equal(dots.length, Math.min(count, MAX_PAGINATION_DOTS));
      assert.equal(dots.filter((dot) => dot.size === "active").length, 1);
      assert.equal(dots.find((dot) => dot.size === "active").index, current);
      assert.ok(dots.every((dot) => dot.index >= 0 && dot.index < count));
    }
  }
});

test("an out-of-range position is clamped rather than breaking the row", () => {
  assert.equal(describe(paginationDots({ count: 3, current: 7 })), "0 1 2*");
  assert.equal(describe(paginationDots({ count: 3, current: -2 })), "0* 1 2");
});
