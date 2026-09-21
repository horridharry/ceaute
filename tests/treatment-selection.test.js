import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTreatmentTimeHref,
  calculateSelectionTotals,
} from "../src/features/storefront/treatment-selection.js";

const treatment = {
  id: "treatment-1",
  price_pence: 3500,
  duration_minutes: 45,
};

const removals = {
  id: "add-on-removals",
  additional_price_pence: 1000,
  additional_duration_minutes: 25,
};

const nailArt = {
  id: "add-on-nail-art",
  additional_price_pence: 500,
  additional_duration_minutes: 15,
};

test("a treatment with no add-ons totals its own price and duration", () => {
  assert.deepEqual(
    calculateSelectionTotals({ treatment, selectedAddOns: [] }),
    { totalPricePence: 3500, totalDurationMinutes: 45 },
  );
});

test("one selected add-on adds its price and duration to the treatment", () => {
  assert.deepEqual(
    calculateSelectionTotals({ treatment, selectedAddOns: [removals] }),
    { totalPricePence: 4500, totalDurationMinutes: 70 },
  );
});

test("multiple selected add-ons all contribute to the total", () => {
  assert.deepEqual(
    calculateSelectionTotals({
      treatment,
      selectedAddOns: [removals, nailArt],
    }),
    { totalPricePence: 5000, totalDurationMinutes: 85 },
  );
});

test("deselecting back down to zero add-ons returns to the base total", () => {
  const withBoth = calculateSelectionTotals({
    treatment,
    selectedAddOns: [removals, nailArt],
  });
  const withNone = calculateSelectionTotals({
    treatment,
    selectedAddOns: [],
  });

  assert.notDeepEqual(withBoth, withNone);
  assert.deepEqual(withNone, { totalPricePence: 3500, totalDurationMinutes: 45 });
});

test("a treatment with no add-ons links straight to the time page", () => {
  assert.equal(
    buildTreatmentTimeHref({ username: "cluxeklaws", treatmentId: "t1", addOnIds: [] }),
    "/@cluxeklaws/book/t1/time",
  );
});

test("selected add-ons travel to the time page as repeated add_on parameters", () => {
  const href = buildTreatmentTimeHref({
    username: "cluxeklaws",
    treatmentId: "t1",
    addOnIds: ["a1", "a2"],
  });

  assert.equal(href, "/@cluxeklaws/book/t1/time?add_on=a1&add_on=a2");
});

// The time page (book/[treatmentId]/time/page.jsx) and its "Change add-ons"
// link read the same `add_on` query parameter this helper writes, and the
// server recomputes availability from it on every load. A customer who
// navigates back to this link after choosing a time therefore sees the same
// add-ons still selected, and a duration change is revalidated because it is
// the server, not the sheet, that derives available slots from the URL.
test("the link is exactly the URL the existing add-ons and time pages already read", () => {
  const href = buildTreatmentTimeHref({
    username: "cluxeklaws",
    treatmentId: "t1",
    addOnIds: ["a1"],
  });
  const url = new URL(href, "https://example.com");

  assert.equal(url.pathname, "/@cluxeklaws/book/t1/time");
  assert.deepEqual(url.searchParams.getAll("add_on"), ["a1"]);
});
