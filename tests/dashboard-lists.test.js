import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  groupTreatmentsLine,
  lifecycleFilterOptions,
  lifecycleStatus,
  splitByState,
  worksWithLine,
} from "../src/app/(dashboard)/dashboard/_lib/lifecycle-lists.js";
import { formatPrice, formatShortDuration } from "../src/app/(dashboard)/dashboard/_lib/price-duration.js";
import { TreatmentAddOnsPage } from "../src/app/(dashboard)/dashboard/add-ons/_components/treatment-add-ons-page.jsx";
import { TreatmentGroupsPage } from "../src/app/(dashboard)/dashboard/treatment-groups/_components/treatment-groups-page.jsx";
import { TreatmentsUI } from "../src/app/(dashboard)/dashboard/treatments/_components/treatments-page.jsx";
import {
  ALL_GROUPS,
  buildTreatmentListSections,
  treatmentGroupPills,
} from "../src/app/(dashboard)/dashboard/treatments/_lib/treatment-list.js";

const render = (element) => renderToStaticMarkup(element);
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const noop = async () => ({ status: "done", message: "" });

test("the lifecycle filter defaults to Active and only knows Archived besides", () => {
  assert.equal(lifecycleStatus(undefined), "active");
  assert.equal(lifecycleStatus("archived"), "archived");
  assert.equal(lifecycleStatus("deleted"), "active", "deleted records have no filter");
  assert.deepEqual(splitByState([{ is_active: true }, { is_active: false }, { is_active: true }]).active.length, 2);
  assert.deepEqual(lifecycleFilterOptions({ basePath: "/dashboard/add-ons", active: 3, archived: 0 }), [
    { key: "active", label: "Active", href: "/dashboard/add-ons", count: 3 },
    { key: "archived", label: "Archived", href: "/dashboard/add-ons?status=archived", count: 0 },
  ]);
});

test("a group row names its dependencies, archived treatments included", () => {
  assert.equal(groupTreatmentsLine([]), "No treatments");
  assert.equal(groupTreatmentsLine([{ is_active: true }, { is_active: true }, { is_active: false }]), "2 treatments · 1 archived");
  assert.equal(groupTreatmentsLine([{ is_active: false }]), "1 archived treatment");
  assert.equal(worksWithLine(1), "Works with 1 treatment");
});

test("list prices and durations read like the prototype", () => {
  assert.equal(formatPrice(800), "£8.00");
  assert.equal(formatShortDuration(75), "1 h 15 min");
  assert.equal(formatShortDuration(45), "45 min");
  assert.equal(formatShortDuration(120), "2 h");
});

const addOns = [
  { addOnId: "a1", name: "Nail art (4 nails)", additional_price_pence: 800, additional_duration_minutes: 15, is_active: true, compatible_treatment_count: 3 },
  { addOnId: "a2", name: "Gel removal", additional_price_pence: 1000, additional_duration_minutes: 20, is_active: true, compatible_treatment_count: 5 },
  { addOnId: "a4", name: "French tips", additional_price_pence: 500, additional_duration_minutes: 10, is_active: false, compatible_treatment_count: 2 },
];

test("add-ons: Active is the default filter, with counts, and no Active label on cards", () => {
  const html = render(h(TreatmentAddOnsPage, { addOns, status: "active", transitionAction: noop }));

  assert.match(html, /aria-current="page"[^>]*>Active<span[^>]*>2<\/span>/);
  assert.match(html, /href="\/dashboard\/add-ons\?status=archived"[^>]*>Archived<span[^>]*>1<\/span>/);
  assert.match(html, /Gel removal/);
  assert.doesNotMatch(html, /French tips/, "archived add-ons are under Archived");
  assert.doesNotMatch(html, />Active<\/span>/, "no redundant Active badge");
  assert.match(html, /\+£10\.00 · \+20 min/);
  assert.match(html, /Works with 5 treatments/);
  assert.match(html, /aria-label="Actions for Gel removal"/);
});

test("add-ons: the Archived filter shows only archived add-ons", () => {
  const html = render(h(TreatmentAddOnsPage, { addOns, status: "archived", transitionAction: noop }));
  assert.match(html, /French tips/);
  assert.doesNotMatch(html, /Gel removal/);
  assert.match(html, /aria-current="page"[^>]*>Archived/);
});

test("add-ons: empty states say what to do", () => {
  assert.match(render(h(TreatmentAddOnsPage, { addOns: [], status: "active", transitionAction: noop })), /No add-ons yet\. Add-ons let customers extend a treatment\./);
  assert.match(render(h(TreatmentAddOnsPage, { addOns: [addOns[0]], status: "archived", transitionAction: noop })), /No archived add-ons\./);
});

const groups = [
  { id: "g1", name: "Manicures", is_active: true, treatments: [{ id: "t1", name: "Gel manicure", is_active: true }] },
  { id: "g4", name: "Nail care", is_active: true, treatments: [] },
  { id: "g6", name: "Bridal", is_active: false, treatments: [{ id: "t9", name: "Bridal trial", is_active: false }] },
];

test("treatment groups: filtered lists with dependency lines and menus", () => {
  const active = render(h(TreatmentGroupsPage, { groups, status: "active", transitionAction: noop }));
  assert.match(active, /aria-current="page"[^>]*>Active<span[^>]*>2<\/span>/);
  assert.match(active, /1 treatment/);
  assert.match(active, /No treatments/);
  assert.doesNotMatch(active, /Bridal/);
  assert.match(active, /aria-label="Actions for Nail care"/);

  const archived = render(h(TreatmentGroupsPage, { groups, status: "archived", transitionAction: noop }));
  assert.match(archived, /Bridal/);
  assert.match(archived, /1 archived treatment/);
});

const treatments = [
  { treatmentId: "t1", name: "Gel manicure", description: "Shape and gel colour.", price_pence: 3500, duration_minutes: 60, is_active: true, treatment_group_id: "g1", treatment_group_name: "Manicures", add_on_count: 3 },
  { treatmentId: "t4", name: "Acrylic full set", description: "Sculpted extensions.", price_pence: 5500, duration_minutes: 120, is_active: true, treatment_group_id: "g2", treatment_group_name: "Extensions", add_on_count: 0 },
  { treatmentId: "t7", name: "Express pedicure", description: "Shape and polish.", price_pence: 2500, duration_minutes: 40, is_active: true, treatment_group_id: "", treatment_group_name: "", add_on_count: 0 },
  { treatmentId: "t9", name: "Bridal trial", description: "Trial set.", price_pence: 5000, duration_minutes: 90, is_active: false, treatment_group_id: "g6", treatment_group_name: "Bridal", treatment_group_archived: true, add_on_count: 0 },
];
const activeGroups = [{ id: "g1", name: "Manicures" }, { id: "g2", name: "Extensions" }];

test("treatments are arranged under their groups, ungrouped last, and searchable by name", () => {
  const all = buildTreatmentListSections({ treatments, groups: activeGroups });
  assert.deepEqual(all.sections.map((section) => section.name), ["Manicures", "Extensions", "Other treatments"]);
  assert.equal(all.count, 3, "archived treatments are not in the sections");

  const search = buildTreatmentListSections({ treatments, groups: activeGroups, query: "GEL" });
  assert.deepEqual(search.sections.map((section) => section.treatments.map((t) => t.name)), [["Gel manicure"]]);

  const filtered = buildTreatmentListSections({ treatments, groups: activeGroups, groupFilter: "g2" });
  assert.equal(filtered.count, 1);
  assert.deepEqual(treatmentGroupPills({ treatments, groups: activeGroups }).map((pill) => pill.key), [ALL_GROUPS, "g1", "g2"]);
  assert.deepEqual(treatmentGroupPills({ treatments, groups: [activeGroups[0]] }), [], "one group needs no pills");
});

test("treatments screen: cards with price, time and add-on count; archived ones collapsed with their group", () => {
  const html = render(h(TreatmentsUI, { treatments, groups: activeGroups }));
  assert.match(html, /<label for="treatment-search" class="sr-only">Search treatments<\/label>/);
  assert.match(html, /role="group" aria-label="Filter treatments by group"/);
  assert.match(html, /£35\.00 · 1 h · 3 add-ons/);
  assert.match(html, /<summary[^>]*>Archived treatments \(1\)/);
  assert.match(html, /Bridal \(archived group\)/);
  assert.doesNotMatch(html, />Active</, "no Active badge on cards");
  assert.equal(count(html, /<h1/g), 1);
});
