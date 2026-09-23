import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { UnsavedChangesContext } from "../src/components/unsaved-changes/unsaved-changes-provider.jsx";
import { TreatmentAddOnForm } from "../src/app/(dashboard)/dashboard/add-ons/_components/treatment-add-on-form.jsx";
import { LocationFormUI } from "../src/app/(dashboard)/dashboard/locations/_components/location-form-ui.jsx";
import { TreatmentGroupForm } from "../src/app/(dashboard)/dashboard/treatment-groups/_components/treatment-group-form.jsx";
import { TreatmentForm } from "../src/app/(dashboard)/dashboard/treatments/_components/treatment-form.jsx";

// Every create and edit form follows Booking settings: one submit, at the end
// of the form, and no submit in the header.
// The forms register an unsaved-changes guard, so they render inside the
// provider's context (a stand-in: nothing navigates during a static render).
const guardContext = { register() {}, unregister() {}, navigate() {}, isConfirming: false };
const render = (element) =>
  renderToStaticMarkup(h(UnsavedChangesContext.Provider, { value: guardContext }, element));
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const noop = async () => "";

const treatment = {
  treatmentId: "t9",
  name: "Bridal trial",
  description: "Trial set before the big day.",
  price: 50,
  duration_minutes: 90,
  discovery_category_id: "c1",
  treatment_group_id: "g6",
  is_active: false,
  archived_group: { id: "g6", name: "Bridal" },
};

const forms = {
  "new treatment": h(TreatmentForm, { action: noop, mode: "create", discoveryCategories: [{ id: "c1", name: "Nails" }], treatmentGroups: [] }),
  "edit treatment": h(TreatmentForm, { action: noop, archiveAction: noop, restoreAction: noop, mode: "edit", treatment, discoveryCategories: [{ id: "c1", name: "Nails" }], treatmentGroups: [{ id: "g1", name: "Manicures" }, { id: "g6", name: "Bridal" }] }),
  "new group": h(TreatmentGroupForm, { action: noop }),
  "edit group": h(TreatmentGroupForm, { action: noop, group: { id: "g1", name: "Manicures" } }),
  "new add-on": h(TreatmentAddOnForm, { action: noop, mode: "create", treatments: [] }),
  "new location": h(LocationFormUI, { action: noop }),
  "edit location": h(LocationFormUI, { action: noop, location: { id: "l1", public_area: "Peckham, London", city: "London", postcode: "SE15 4RF" } }),
};

for (const [name, element] of Object.entries(forms)) {
  test(`${name}: one main, one h1, and its only form submit is at the end`, () => {
    const html = render(element);
    assert.equal(count(html, /<main/g), 1);
    assert.equal(count(html, /<h1/g), 1);
    const mainForm = html.slice(html.indexOf("<form"), html.indexOf("</form>") + 7);
    assert.equal(count(mainForm, /type="submit"/g), 1);
    assert.match(mainForm, /justify-end[^>]*>(<p[^>]*>[^<]*<\/p>)?<a[^>]*>Discard<\/a><button[^>]*type="submit"/);
    assert.doesNotMatch(html.slice(0, html.indexOf("<form")), /type="submit"/, "no submit in the header");
  });
}

// Approved 23 September 2026: create and edit forms keep the app header and
// show a back link, a clear heading, and Discard before the save action.
const headings = {
  "new treatment": ["/dashboard/treatments", "Treatments", "New treatment"],
  "edit treatment": ["/dashboard/treatments", "Treatments", "Edit treatment"],
  "new group": ["/dashboard/treatment-groups", "Treatment groups", "New treatment group"],
  "edit group": ["/dashboard/treatment-groups", "Treatment groups", "Edit treatment group"],
  "new add-on": ["/dashboard/add-ons", "Add-ons", "New add-on"],
  "new location": ["/dashboard/locations", "Locations", "New location"],
  "edit location": ["/dashboard/locations", "Locations", "Edit location"],
};

for (const [name, [listHref, listLabel, title]] of Object.entries(headings)) {
  test(`${name}: back link to ${listLabel}, heading "${title}", Discard returns to the list`, () => {
    const html = render(forms[name]);
    assert.match(html, new RegExp(`<a[^>]*href="${listHref}"[^>]*>.*Back to </span>${listLabel}</a>`));
    assert.match(html, new RegExp(`<h1[^>]*>${title}</h1>`));
    assert.match(html, new RegExp(`<a[^>]*href="${listHref}"[^>]*>Discard</a>`));
    assert.doesNotMatch(html, />Cancel</);
  });
}

test("edit forms keep Save as the primary action; create forms keep their Add label", () => {
  assert.match(render(forms["edit treatment"]), />Discard<\/a><button[^>]*type="submit"[^>]*>Save</);
  assert.match(render(forms["edit group"]), />Discard<\/a><button[^>]*type="submit"[^>]*>Save</);
  assert.match(render(forms["new treatment"]), />Discard<\/a><button[^>]*type="submit"[^>]*>Add treatment</);
  assert.match(render(forms["new location"]), />Discard<\/a><button[^>]*type="submit"[^>]*>Add location</);
});

test("a treatment in an archived group shows that group, marked, and selected", () => {
  const html = render(forms["edit treatment"]);
  assert.match(html, /<option value="g6" selected="">Bridal \(archived\)<\/option>/);
  assert.equal(count(html, /value="g6"/g), 1, "the archived group is listed once");
  assert.match(html, /This group is archived\. Choose another group or No group to move the treatment out\./);
  assert.match(html, /aria-describedby="treatment_group_id-hint"/);
});

test("a treatment in an active group gets no archived hint", () => {
  const html = render(h(TreatmentForm, { action: noop, archiveAction: noop, restoreAction: noop, mode: "edit", treatment: { ...treatment, is_active: true, treatment_group_id: "g1", archived_group: null }, discoveryCategories: [{ id: "c1", name: "Nails" }], treatmentGroups: [{ id: "g1", name: "Manicures" }] }));
  assert.doesNotMatch(html, /\(archived\)/);
  assert.match(html, /<option value="g1" selected="">Manicures<\/option>/);
});

test("location form: only the truly optional fields say so, City and Postcode share a row", () => {
  const html = render(forms["new location"]);
  assert.equal(count(html, /\(optional\)/g), 2);
  assert.match(html, /grid grid-cols-2[\s\S]*for="city"[\s\S]*for="postcode"/);
  assert.doesNotMatch(html, /text-red-600/);
});

test("saves return to the list instead of showing success in error styling", () => {
  const locations = readFileSync("src/app/(dashboard)/dashboard/locations/actions.js", "utf8");
  const groups = readFileSync("src/app/(dashboard)/dashboard/treatment-groups/actions.js", "utf8");
  assert.doesNotMatch(locations, /return "Location saved\."|return "Saved\."/);
  assert.match(locations, /redirect\("\/dashboard\/locations"\)/);
  assert.doesNotMatch(groups, /return "Group created\."|return "Group renamed\."/);
  assert.match(groups, /redirect\("\/dashboard\/treatment-groups"\)/);
});

test("saving a treatment keeps an archived group only when it is unchanged", () => {
  const actions = readFileSync("src/app/(dashboard)/dashboard/treatments/actions.js", "utf8");
  assert.match(actions, /treatmentGroupId && treatmentGroupId !== currentGroupId/);
  assert.match(actions, /currentGroupId: current\.treatment_group_id/);
});

test("a refused group name stays in the field, with the reason linked to it", () => {
  const form = readFileSync("src/app/(dashboard)/dashboard/treatment-groups/_components/treatment-group-form.jsx", "utf8");
  assert.match(form, /value=\{name\}/, "controlled, so React's form reset cannot clear it");
  assert.doesNotMatch(form, /defaultValue/);
  assert.match(form, /error=\{message\}/, "the refusal is the name field's error");
  const html = render(h(TreatmentGroupForm, { action: noop, group: { id: "g1", name: "Manicures" } }));
  assert.match(html, /id="group_name"[^>]*value="Manicures"|value="Manicures"[^>]*id="group_name"/);
});
