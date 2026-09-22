import assert from "node:assert/strict";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ActionMenu } from "../src/components/ui/action-menu.jsx";
import { Badge } from "../src/components/ui/badge.jsx";
import { buttonClassName, BUTTON_VARIANTS } from "../src/components/ui/button-classes.js";
import { ConfirmDialog } from "../src/components/ui/confirm-dialog.jsx";
import { Disclosure } from "../src/components/ui/disclosure.jsx";
import { Field } from "../src/components/ui/field.jsx";
import { FormActions } from "../src/components/ui/form-actions.jsx";
import { LinkFilterPills, ToggleFilterPills } from "../src/components/ui/filter-pills.jsx";
import { containerClassName } from "../src/components/ui/layout-classes.js";
import { DashboardPage } from "../src/app/(dashboard)/dashboard/_components/dashboard-page.jsx";
import { ManagementRow } from "../src/app/(dashboard)/dashboard/_components/management-row.jsx";

// The dashboard redesign's shared patterns, rendered to HTML so the tests
// assert on what a browser receives.
const render = (element) => renderToStaticMarkup(element);
const count = (html, pattern) => (html.match(pattern) ?? []).length;

test("link filter pills mark the current filter and show counts", () => {
  const html = render(
    h(LinkFilterPills, {
      label: "Filter add-ons",
      value: "active",
      options: [
        { key: "active", label: "Active", href: "/dashboard/add-ons", count: 3 },
        { key: "archived", label: "Archived", href: "/dashboard/add-ons?status=archived", count: 0 },
      ],
    }),
  );

  assert.match(html, /<nav aria-label="Filter add-ons"/);
  assert.equal(count(html, /aria-current="page"/g), 1);
  assert.match(html, /aria-current="page"[^>]*>Active<span[^>]*>3<\/span>/);
  assert.match(html, /href="\/dashboard\/add-ons\?status=archived"[^>]*>Archived<span[^>]*>0<\/span>/);
  assert.match(html, /bg-black text-white/);
  assert.match(html, /focus-visible:outline-2/);
});

test("toggle filter pills are pressed buttons in a labelled group", () => {
  const html = render(
    h(ToggleFilterPills, {
      label: "Filter treatments by group",
      value: "g2",
      onChange: () => {},
      options: [
        { key: "all", label: "All groups" },
        { key: "g2", label: "Extensions" },
      ],
    }),
  );

  assert.match(html, /role="group" aria-label="Filter treatments by group"/);
  assert.match(html, /type="button" aria-pressed="false"[^>]*>All groups/);
  assert.match(html, /type="button" aria-pressed="true"[^>]*>Extensions/);
});

test("badges stay neutral; a dot carries attention or live state", () => {
  assert.doesNotMatch(render(h(Badge, null, "Archived")), /rounded-full bg-/);
  assert.match(render(h(Badge, { tone: "attention" }, "Primary")), /aria-hidden="true" class="[^"]*bg-action/);
  assert.match(render(h(Badge, { tone: "live" }, "Connected")), /bg-green-700/);
  assert.match(render(h(Badge, { tone: "quiet" }, "By you")), /bg-surface-subtle/);
});

test("form actions put one submit on the right with an optional neutral status", () => {
  const html = render(
    h(FormActions, { status: "Saved" }, h("button", { type: "submit" }, "Save")),
  );

  assert.match(html, /justify-end/);
  assert.match(html, /role="status"[^>]*class="[^"]*text-ink-muted[^"]*">Saved<\/p><button type="submit">Save/);
  assert.doesNotMatch(html, /text-danger|text-red/);
});

test("a field puts its label 6px above the control and its error below it", () => {
  const html = render(
    h(Field, { label: "Name", htmlFor: "name", hint: "Shown to customers", error: "Please enter a name." }, (control) =>
      h("input", { ...control, name: "name" }),
    ),
  );

  assert.match(html, /gap-1\.5/);
  const order = ["<label", 'id="name-hint"', "<input", 'id="name-error"'].map((marker) => html.indexOf(marker));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.match(html, /aria-describedby="name-hint name-error"/);
  assert.match(html, /aria-invalid="true"/);
});

test("a closed action menu is one labelled button that controls nothing yet", () => {
  const html = render(h(ActionMenu, { label: "Actions for Gel removal", items: [] }));

  assert.match(html, /<button type="button" aria-label="Actions for Gel removal" aria-expanded="false"/);
  assert.match(html, /h-11 w-11/);
  assert.doesNotMatch(html, /role="group"/);
});

test("a confirmation puts the safe choice first and the irreversible one in destructive-strong", () => {
  const html = render(
    h(ConfirmDialog, {
      open: false,
      title: "Delete French tips?",
      description: "This can’t be undone. Past bookings keep their details.",
      confirmLabel: "Delete add-on",
      cancelLabel: "Keep add-on",
      error: "That add-on no longer exists.",
      onCancel: () => {},
    }),
  );

  assert.match(html, /<dialog aria-labelledby="[^"]+" aria-describedby="[^"]+"/);
  assert.ok(html.indexOf("Keep add-on") < html.indexOf("Delete add-on"));
  assert.match(html, /class="[^"]*bg-destructive[^"]*"[^>]*>Delete add-on/);
  assert.match(html, /role="alert"[^>]*>That add-on no longer exists\./);
  assert.match(html, /backdrop:bg-scrim/);
});

test("a blocked explanation offers only OK", () => {
  const html = render(
    h(
      ConfirmDialog,
      { open: false, blocked: true, title: "Extensions can’t be archived yet", onCancel: () => {} },
      h("ul", null, h("li", null, "Acrylic full set")),
    ),
  );

  assert.equal(count(html, /<button/g), 1);
  assert.match(html, />OK<\/button>/);
  assert.match(html, /Acrylic full set/);
});

test("a pending confirmation disables both choices and announces it is busy", () => {
  const html = render(
    h(ConfirmDialog, { open: false, title: "Archive?", confirmLabel: "Archive", pendingLabel: "Archiving…", pending: true, tone: "primary", onCancel: () => {} }),
  );

  assert.equal(count(html, /disabled=""/g), 2);
  assert.match(html, /aria-busy="true"[^>]*>Archiving…/);
});

test("destructive-strong exists and has focus and disabled styling", () => {
  assert.ok(BUTTON_VARIANTS.includes("destructive-strong"));
  const classes = buttonClassName({ variant: "destructive-strong" });
  assert.match(classes, /bg-destructive/);
  assert.match(classes, /focus-visible:outline-2/);
  assert.match(classes, /disabled:opacity-60/);
});

test("the medium width is for the portfolio grid", () => {
  assert.match(containerClassName({ width: "medium" }), /max-w-2xl p-5/);
  assert.match(containerClassName({ width: "medium" }), /mx-auto/);
});

test("a disclosure is a native details element with a focusable summary", () => {
  const html = render(h(Disclosure, { summary: "Fees and refunds" }, h("p", null, "Example £50 online payment")));
  assert.match(html, /<details class="group border-y border-line"><summary/);
  assert.match(html, /focus-visible:outline-2/);
  assert.doesNotMatch(html, /<details[^>]* open/);
});

test("a dashboard page is one centred main with one h1, its description and New link", () => {
  const html = render(
    h(DashboardPage, { title: "Add-ons", description: "Extras customers can add to a treatment.", newHref: "/dashboard/add-ons/new" }, h("p", null, "list")),
  );

  assert.equal(count(html, /<main/g), 1);
  assert.equal(count(html, /<h1/g), 1);
  assert.match(html, /<main class="[^"]*mx-auto[^"]*max-w-md/);
  assert.match(html, /Extras customers can add to a treatment\./);
  assert.match(html, /href="\/dashboard\/add-ons\/new"/);
});

test("a management row is an edit link with its menu beside it, not inside it", () => {
  const html = render(
    h("ul", null, h(ManagementRow, {
      href: "/dashboard/add-ons/a1/edit",
      name: "Gel removal",
      meta: ["+£10.00 · +20 min", "Works with 5 treatments"],
      menu: h("button", { type: "button", "aria-label": "Actions for Gel removal" }),
    })),
  );

  assert.match(html, /<a class="[^"]*" href="\/dashboard\/add-ons\/a1\/edit">/);
  assert.equal(count(html, /<a /g), 1);
  assert.ok(html.indexOf("</a>") < html.indexOf('aria-label="Actions for Gel removal"'));
});
