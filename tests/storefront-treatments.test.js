import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_TREATMENTS_FILTER,
  TREATMENT_PREVIEW_COUNT,
  UNGROUPED_SECTION_KEY,
  buildTreatmentSections,
  filterTreatmentSections,
  hasMoreTreatments,
  sectionHeading,
  treatmentFilterOptions,
  treatmentPreview,
  treatmentsHref,
  treatmentsInOrder,
} from "../src/features/storefront/treatment-sections.js";
import { treatmentQueries } from "../src/features/storefront/treatment-queries.js";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

const group = (id, name) => ({ id, name, display_order: 0 });
const treatment = (id, groupId = null) => ({
  id,
  name: `Treatment ${id}`,
  description: null,
  duration_minutes: 60,
  price_pence: 4000,
  display_order: 0,
  treatment_group_id: groupId,
  updated_at: "2026-09-22T12:00:00Z",
});

// Rows arrive in query order (see treatmentQueries); sections keep it.
function sections({ groups = [], treatments = [], addOns = [], compatibility = [] }) {
  return buildTreatmentSections({ groups, treatments, addOns, compatibility });
}

const ids = (list) => list.map((item) => item.id);

test("the preview is the first three treatments in page order, across groups", () => {
  const built = sections({
    groups: [group("g1", "Acrylics"), group("g2", "Gel")],
    treatments: [treatment("a", "g2"), treatment("b", "g1"), treatment("c", "g2"), treatment("d", "g1"), treatment("e")],
  });

  assert.equal(TREATMENT_PREVIEW_COUNT, 3);
  // Group order first (g1 then g2, then ungrouped), query order within each.
  assert.deepEqual(ids(treatmentsInOrder(built)), ["b", "d", "a", "c", "e"]);
  assert.deepEqual(ids(treatmentPreview(built)), ["b", "d", "a"]);
  assert.equal(hasMoreTreatments(built), true);
  // Preview entries are plain treatments: no group heading travels with them.
  for (const item of treatmentPreview(built)) {
    assert.deepEqual(Object.keys(item).sort(), ["add_ons", "description", "duration_minutes", "id", "name", "price_pence"]);
  }
});

test("zero to three treatments show as they are, with no See all", () => {
  for (const count of [0, 1, 2, 3]) {
    const built = sections({ treatments: Array.from({ length: count }, (_, index) => treatment(`t${index}`)) });
    assert.equal(treatmentPreview(built).length, count);
    assert.equal(hasMoreTreatments(built), false, `${count} treatments`);
  }
  assert.deepEqual(sections({}), [], "no treatments, no sections");
  assert.equal(hasMoreTreatments(sections({ treatments: ["a", "b", "c", "d"].map((id) => treatment(id)) })), true);
});

test("sections: active groups only, empty groups dropped, inactive-group treatments ungrouped", () => {
  const built = sections({
    // g3 has no treatments; "gone" is not an active group (not returned by the query).
    groups: [group("g1", "Acrylics"), group("g3", "Toes")],
    treatments: [treatment("a", "g1"), treatment("b", "gone"), treatment("c")],
  });

  assert.deepEqual(built.map((section) => section.key), ["g1", UNGROUPED_SECTION_KEY]);
  assert.deepEqual(ids(built[1].treatments), ["b", "c"]);
});

test("treatments that tie keep the query's order, which ends with the id", () => {
  const built = sections({ treatments: ["x", "y", "z"].map((id) => treatment(id)) });
  assert.deepEqual(ids(treatmentsInOrder(built)), ["x", "y", "z"]);
});

test("add-ons: only active and compatible ones, in add-on order, with booking fields only", () => {
  const built = sections({
    treatments: [treatment("a")],
    addOns: [
      { id: "o1", name: "Art", additional_price_pence: 500, additional_duration_minutes: 15, display_order: 0 },
      { id: "o2", name: "Gems", additional_price_pence: 300, additional_duration_minutes: 10, display_order: 0 },
    ],
    // Compatibility rows arrive in no particular order; "o9" is inactive.
    compatibility: [
      { treatment_id: "a", treatment_add_on_id: "o2" },
      { treatment_id: "a", treatment_add_on_id: "o9" },
      { treatment_id: "a", treatment_add_on_id: "o1" },
    ],
  });

  const addOns = built[0].treatments[0].add_ons;
  assert.deepEqual(ids(addOns), ["o1", "o2"]);
  assert.deepEqual(Object.keys(addOns[0]).sort(), ["additional_duration_minutes", "additional_price_pence", "id", "name"]);
});

test("headings: group names, and Other treatments only below other groups", () => {
  const grouped = sections({ groups: [group("g1", "Acrylics")], treatments: [treatment("a", "g1"), treatment("b")] });
  assert.deepEqual(grouped.map((section) => sectionHeading(section, grouped)), ["Acrylics", "Other treatments"]);

  const ungrouped = sections({ treatments: [treatment("a")] });
  assert.deepEqual(ungrouped.map((section) => sectionHeading(section, ungrouped)), [null]);
});

test("filter pills: All plus each group with treatments, hidden below two groups", () => {
  const two = sections({
    groups: [group("g1", "Acrylics"), group("g2", "Gel"), group("g3", "Empty")],
    treatments: [treatment("a", "g1"), treatment("b", "g2"), treatment("c")],
  });
  assert.deepEqual(treatmentFilterOptions(two), [
    { key: ALL_TREATMENTS_FILTER, label: "All" },
    { key: "g1", label: "Acrylics" },
    { key: "g2", label: "Gel" },
  ]);

  const one = sections({ groups: [group("g1", "Acrylics")], treatments: [treatment("a", "g1"), treatment("b")] });
  assert.deepEqual(treatmentFilterOptions(one), [], "one group and ungrouped treatments: no pills");
  assert.deepEqual(treatmentFilterOptions(sections({ treatments: [treatment("a")] })), []);
  assert.deepEqual(treatmentFilterOptions([]), []);
});

test("filtering shows the chosen group only, in order; All and unknown keys show everything", () => {
  const built = sections({
    groups: [group("g1", "Acrylics"), group("g2", "Gel")],
    treatments: [treatment("a", "g1"), treatment("b", "g2"), treatment("c", "g2"), treatment("d")],
  });

  assert.deepEqual(filterTreatmentSections(built, ALL_TREATMENTS_FILTER), built);
  assert.deepEqual(filterTreatmentSections(built, "missing"), built);
  const gel = filterTreatmentSections(built, "g2");
  assert.deepEqual(gel.map((section) => section.key), ["g2"]);
  assert.deepEqual(ids(gel[0].treatments), ["b", "c"]);
  assert.equal(sectionHeading(gel[0], built), "Gel", "a filtered group keeps its heading");
});

test("the All treatments link uses the public username", () => {
  assert.equal(treatmentsHref("ada"), "/@ada/treatments");
});

// A stand-in for the Supabase query builder that records each call.
function recordingClient() {
  const calls = {};
  const builder = (table) => {
    const log = (calls[table] = []);
    const chain = new Proxy({}, {
      get: (_, method) => (...args) => {
        log.push([method, ...args]);
        return chain;
      },
    });
    return chain;
  };
  return { calls, client: { schema: () => ({ from: builder }) } };
}

test("public treatment queries: active rows of this page, ordered with an id tie-breaker", () => {
  const { calls, client } = recordingClient();
  treatmentQueries(client, "page-1");

  const orders = (table) => calls[table].filter(([method]) => method === "order").map(([, column, options]) => `${column} ${options.ascending ? "asc" : "desc"}`);
  const filters = (table) => calls[table].filter(([method]) => method === "eq").map(([, column, value]) => `${column}=${value}`);

  assert.deepEqual(orders("treatment_group"), ["display_order asc", "name asc", "id asc"]);
  assert.deepEqual(orders("treatment"), ["display_order asc", "updated_at desc", "id asc"]);
  assert.deepEqual(orders("treatment_add_on"), ["display_order asc", "name asc", "id asc"]);
  for (const table of ["treatment_group", "treatment", "treatment_add_on"]) {
    assert.deepEqual(filters(table), ["provider_page_id=page-1", "is_active=true"], table);
  }
  assert.deepEqual(filters("treatment_add_on_compatibility"), ["provider_page_id=page-1"]);
});

test("treatment rules stay pure; the filter UI reaches data only through props", () => {
  const rules = read("src/features/storefront/treatment-sections.js");
  assert.doesNotMatch(rules, /^import /m, "treatment-sections imports nothing");
  const filterUi = read("src/features/storefront/all-treatments.jsx");
  assert.doesNotMatch(filterUi, /supabase|treatment-queries|useSearchParams|router\.(push|replace)/,
    "the filter is page state, not a query parameter");
  assert.match(filterUi, /aria-pressed=\{selected\}/, "pills expose their selected state");
  assert.match(filterUi, /role="group"[\s\S]*aria-label="Filter treatments by group"/);
});

test("both pages book through the same selection list and link", () => {
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const allTreatments = read("src/features/storefront/all-treatments.jsx");
  assert.match(storefront, /<TreatmentSelectionList sections=\{previewSections\} username=\{username\} \/>/);
  assert.match(allTreatments, /<TreatmentSelectionList sections=\{shown\} username=\{username\} \/>/);
  const list = read("src/features/storefront/treatment-selection-list.jsx");
  assert.match(list, /buildTreatmentTimeHref\(\{ username, treatmentId: treatment\.id, addOnIds \}\)/);
});
