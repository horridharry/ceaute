import assert from "node:assert/strict";
import test from "node:test";
import { ratingSummary } from "../src/features/storefront/format.js";

test("no reviews gives no rating, which the page shows as New", () => {
  assert.equal(ratingSummary([]), null);
  assert.equal(ratingSummary(undefined), null);
});

test("one review is its own average, counted in the singular", () => {
  assert.deepEqual(ratingSummary([{ rating: 5 }]), {
    average: "5.0",
    count: 1,
    countLabel: "1 review",
  });
});

test("several reviews average to one decimal place", () => {
  assert.deepEqual(
    ratingSummary([{ rating: 5 }, { rating: 4 }, { rating: 4 }]),
    { average: "4.3", count: 3, countLabel: "3 reviews" },
  );
  assert.equal(ratingSummary([{ rating: 5 }, { rating: 4 }]).average, "4.5");
  assert.equal(
    ratingSummary([{ rating: 5 }, { rating: 5 }, { rating: 5 }, { rating: 4 }]).average,
    "4.8",
  );
});

test("values outside the 1 to 5 scale are ignored", () => {
  assert.deepEqual(
    ratingSummary([{ rating: 4 }, { rating: 0 }, { rating: null }, { rating: 6 }]),
    { average: "4.0", count: 1, countLabel: "1 review" },
  );
});
