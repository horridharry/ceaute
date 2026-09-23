import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { viewFromSearch } from "../src/components/history-filter-views.jsx";

const options = { keys: ["upcoming", "completed", "cancelled"], defaultKey: "upcoming", serverKey: "completed" };

// Approved 23 September 2026: booking filters switch on the device and keep
// the URL, Back and Forward working.
test("the URL decides the view: its own key, the default when absent, the server's reading otherwise", () => {
  assert.equal(viewFromSearch("cancelled", options), "cancelled");
  assert.equal(viewFromSearch(null, options), "upcoming");
  assert.equal(viewFromSearch("", options), "upcoming");
  assert.equal(viewFromSearch("previous", options), "completed");
});

test("a filter choice is a real history entry, and re-choosing the current view adds none", () => {
  const source = readFileSync("src/components/history-filter-views.jsx", "utf8");
  assert.match(source, /if \(!selected\) \{\s*window\.history\.pushState\(null, "", option\.href\);/);
  assert.doesNotMatch(source, /replaceState/);
});

test("both booking lists use the instant filter and render every view once", () => {
  for (const path of ["src/app/(dashboard)/dashboard/bookings/page.jsx", "src/app/(account)/account/bookings/page.jsx"]) {
    const page = readFileSync(path, "utf8");
    assert.match(page, /<HistoryFilterViews/);
    assert.doesNotMatch(page, /LinkFilterPills/);
  }
});
