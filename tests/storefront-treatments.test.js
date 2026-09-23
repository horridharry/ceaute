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
  // Preview entries are plain treatments: no group heading travels with them.
  for (const item of treatmentPreview(built)) {
    assert.deepEqual(Object.keys(item).sort(), ["add_ons", "description", "duration_minutes", "id", "name", "price_pence"]);
  }
});

test("the preview never exceeds three, and no treatments means no sections", () => {
  for (const count of [0, 1, 2, 3, 4, 10]) {
    const built = sections({ treatments: Array.from({ length: count }, (_, index) => treatment(`t${index}`)) });
    assert.equal(treatmentPreview(built).length, Math.min(count, 3), `${count} treatments`);
  }
  assert.deepEqual(sections({}), [], "no treatments, no sections");
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
  // The pills are the shared ToggleFilterPills, which exposes the pressed
  // state inside a labelled group (tests/dashboard-primitives.test.js).
  assert.match(filterUi, /<ToggleFilterPills[\s\S]*label="Filter treatments by group"/);
  const pills = read("src/components/ui/filter-pills.jsx");
  assert.match(pills, /aria-pressed=\{selected\}/, "pills expose their selected state");
  assert.match(pills, /role="group" aria-label=\{label\}/);
});

test("the card reads: name with Book beside it, then a clamped description, then its line", () => {
  const list = read("src/features/storefront/treatment-selection-list.jsx");
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const card = list.slice(list.indexOf("function TreatmentRow"), list.indexOf("function TreatmentDetailsSheet"));
  const sheet = list.slice(list.indexOf("function TreatmentDetailsSheet"));
  const ownerCard = storefront.slice(storefront.indexOf("function TreatmentCard"), storefront.indexOf("const SECONDARY_BUTTON"));

  // Top row: the heading and Book, in that order, with Book unable to shrink.
  assert.match(card, /<div className="flex items-start justify-between gap-3">\s*<h3[\s\S]*?<\/h3>\s*\{bookable \? \(\s*<button[\s\S]*?aria-label=\{`Book \$\{treatment\.name\}`\}/);
  assert.match(card, /shrink-0/, "Book keeps its width beside a long name");
  assert.match(card, /min-h-11/, "Book stays comfortably tappable");
  assert.match(card, /\[overflow-wrap:anywhere\]/, "a long name wraps instead of overlapping Book");
  assert.match(card, /\n\s*Book\n/);
  assert.doesNotMatch(list, />\s*Select\s*</, "no Select left on a customer-facing control");
  assert.match(list, /hasAddOns \? "Choose a time" : "Book"/, "the sheet's straight-to-booking action reads Book too");

  // Description clamped on both cards, whole in the sheet, absent when empty.
  for (const source of [card, ownerCard]) {
    assert.match(source, /line-clamp-2[^"]*text-sm text-black\/60">\s*\{treatment\.description\}/);
    assert.match(source, /\{treatment\.description \? \(/, "a treatment without a description renders nothing");
    assert.match(source, /\{treatmentMetaLine\(treatment\)\}/, "duration, price and add-ons come from one rule");
  }
  assert.doesNotMatch(sheet, /line-clamp/, "the details sheet shows the whole description");
  assert.doesNotMatch(ownerCard, /aria-label=\{`Book/, "the owner preview cannot book");
});

test("See all buttons count everything, not the preview, and Portfolio stays a text link", () => {
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const preview = storefront.slice(storefront.indexOf("function TreatmentsPreview"), storefront.indexOf("const REVIEWS_PREVIEW_COUNT"));

  // The treatments button comes after the list, full width, counting them all.
  assert.match(preview, /const total = treatmentsInOrder\(sections\)\.length;/);
  assert.ok(
    preview.indexOf("TreatmentSelectionList") < preview.indexOf("treatmentsHref(username)"),
    "the button sits below the cards",
  );
  assert.match(preview, /className=\{`mt-2 \$\{SECONDARY_BUTTON\}`\}[\s\S]*?See all \$\{pluralCount\(total, "treatment"\)\}/);
  assert.match(storefront, /const SECONDARY_BUTTON =\s*\n\s*"inline-flex min-h-11 w-full/, "Treatments and Reviews share one button style");
  assert.match(preview, /\{username \? \(\s*<Link href=\{treatmentsHref\(username\)\}/, "the owner preview has no button");

  // Portfolio keeps its text link beside the heading, now with its count.
  const portfolio = storefront.slice(storefront.indexOf("function PortfolioPreview"), storefront.indexOf("export function StorefrontPage"));
  assert.match(portfolio, /className="inline-flex min-h-11 items-center text-sm font-semibold text-pink-600"\s*>\s*\{`See all \$\{pluralCount\(photos\.length, "photo"\)\}`\}/);
  assert.doesNotMatch(portfolio, /SECONDARY_BUTTON/, "Portfolio stays a text link, not a button");
});

test("both pages book through the same selection list and link", () => {
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const allTreatments = read("src/features/storefront/all-treatments.jsx");
  assert.match(storefront, /<TreatmentSelectionList sections=\{previewSections\} username=\{username\} bookable=\{bookable\} \/>/);
  assert.match(allTreatments, /<TreatmentSelectionList sections=\{shown\} username=\{username\} bookable=\{bookable\} \/>/);
  const list = read("src/features/storefront/treatment-selection-list.jsx");
  assert.match(list, /buildTreatmentTimeHref\(\{ username, treatmentId: treatment\.id, addOnIds \}\)/);
});

test("a provider who is not taking bookings keeps the treatments, without Book", () => {
  const list = read("src/features/storefront/treatment-selection-list.jsx");
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const storefrontRoute = read("src/app/(public-provider)/[username]/(storefront)/page.jsx");
  const treatmentsRoute = read("src/app/(public-provider)/[username]/(storefront)/treatments/page.jsx");

  assert.match(list, /export function TreatmentSelectionList\(\{ sections, username, bookable = true \}\)/);
  assert.match(list, /\{bookable \? \(\s*<button[\s\S]*?onClick=\{onContinue\}/, "the sheet's action needs bookable too");
  assert.match(list, /Not taking online bookings right now\./);
  assert.match(storefront, /publicView && !takingBookings \? \(\s*<Notice tone="neutral">/);
  assert.match(storefront, /isn’t taking online bookings right now\./);
  // Both public routes ask PostgreSQL (provider_page_accepts_new_bookings).
  assert.match(storefrontRoute, /getProviderAcceptsBookings\(providerPage\.id\)/);
  assert.match(storefrontRoute, /takingBookings=\{takingBookings\}/);
  assert.match(treatmentsRoute, /getProviderAcceptsBookings\(providerPage\.id\)/);
  assert.match(treatmentsRoute, /bookable=\{takingBookings\}/);
});
