import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { Button } from "../src/components/ui/button.jsx";
import {
  BUTTON_VARIANTS,
  buttonClassName,
} from "../src/components/ui/button-classes.js";
import { PendingButton } from "../src/components/ui/pending-button.jsx";
import { PendingButton as LegacyPendingButton } from "../src/components/pending-button.jsx";
import { pendingButtonState } from "../src/components/ui/pending-state.js";
import { Field } from "../src/components/ui/field.jsx";
import { fieldControlProps } from "../src/components/ui/field-props.js";
import { FormError, FormStatus } from "../src/components/ui/form-feedback.jsx";
import { Input } from "../src/components/ui/input.jsx";
import { PageContainer } from "../src/components/ui/page-container.jsx";
import { PageHeading } from "../src/components/ui/page-heading.jsx";
import { Card, CardLink } from "../src/components/ui/card.jsx";
import { EmptyState } from "../src/components/ui/empty-state.jsx";
import { PageSkeleton, Skeleton, SkeletonGroup } from "../src/components/ui/skeleton.jsx";
import { FormField } from "../src/app/(dashboard)/dashboard/_components/form-field.jsx";
import { SectionHeading } from "../src/app/(dashboard)/dashboard/_components/section-heading.jsx";
import { TreatmentAddOnForm } from "../src/app/(dashboard)/dashboard/add-ons/_components/treatment-add-on-form.jsx";
import NotFoundContent from "../src/components/not-found-content.tsx";
import RouteError from "../src/components/route-error.tsx";

// The design-system primitives rendered to HTML, so these tests assert on
// what a browser receives (elements, attributes, classes) rather than on
// source text. Rendering needs no data, no session and no database.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
const render = (element) => renderToStaticMarkup(element);
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const classOf = (html, tag) => html.match(new RegExp(`<${tag}[^>]*class="([^"]*)"`))?.[1] ?? "";

// The first <tag> whose attributes include every expected name="value" pair,
// in any order; a value that is a RegExp is matched instead of compared.
function findTag(html, tag, expected) {
  for (const [, attributeText] of html.matchAll(new RegExp(`<${tag}(\\s[^>]*)?>`, "g"))) {
    const attributes = Object.fromEntries(
      [...(attributeText ?? "").matchAll(/([\w:-]+)(?:="([^"]*)")?/g)].map(([, name, value]) => [name, value ?? ""]),
    );
    const matches = Object.entries(expected).every(([name, value]) =>
      value instanceof RegExp ? value.test(attributes[name] ?? "") : attributes[name] === value,
    );
    if (matches) return attributes;
  }
  return null;
}

// --- tokens and the light baseline -----------------------------------------

function themeTokens() {
  const css = read("src/app/globals.css");
  const block = css.slice(css.indexOf("@theme inline {"), css.indexOf("}", css.indexOf("@theme inline {")));
  return Object.fromEntries(
    [...block.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]),
  );
}

const mix = (percent) => `color-mix(in oklab, var(--color-black) ${percent}%, transparent)`;

test("every token is exactly the value the code already used for that role", () => {
  assert.deepEqual(themeTokens(), {
    ink: "var(--color-black)",
    "ink-muted": mix(60),
    "ink-subtle": mix(50),
    surface: "var(--color-white)",
    "surface-subtle": mix(5),
    line: mix(10),
    "line-strong": mix(20),
    action: "var(--color-pink-700)",
    "action-strong": "var(--color-pink-800)",
    accent: "var(--color-pink-600)",
    "accent-strong": "var(--color-pink-700)",
    focus: "var(--color-pink-600)",
    "field-focus": "var(--color-pink-500)",
    "field-focus-ring": "var(--color-pink-100)",
    danger: "var(--color-red-600)",
    "danger-line": "var(--color-red-200)",
    destructive: "var(--color-rose-600)",
    "destructive-surface": "var(--color-rose-50)",
    scrim: mix(40),
  });
});

test("the document is light-only: light scheme, white page, dark text, white browser chrome", () => {
  const css = read("src/app/globals.css");
  const base = css.slice(css.indexOf("@layer base"), css.indexOf("@layer components"));
  assert.match(base, /html \{[^}]*color-scheme: light;[^}]*@apply bg-surface text-ink;/);
  assert.match(base, /body \{\s*@apply bg-surface;/);
  assert.doesNotMatch(css, /prefers-color-scheme|\.dark\b/, "no dark theme");

  const layout = read("src/app/layout.tsx");
  assert.match(layout, /themeColor: "#ffffff"/, "one white theme colour for both OS modes");
  assert.match(layout, /colorScheme: "light"/);
  assert.doesNotMatch(layout, /prefers-color-scheme/);
});

test("nothing stops people zooming the page", () => {
  const offenders = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(js|jsx|ts|tsx)$/.test(entry) && /maximumScale|userScalable|user-scalable|maximum-scale/.test(readFileSync(full, "utf8"))) {
        offenders.push(path.relative(REPO_ROOT, full));
      }
    }
  };
  walk(path.join(REPO_ROOT, "src"));
  assert.deepEqual(offenders, []);
  assert.match(read("src/app/layout.tsx"), /width: "device-width",\s*initialScale: 1,/);
});

// --- Button -----------------------------------------------------------------

test("every button variant has a visible keyboard focus ring and disabled styling", () => {
  assert.deepEqual(BUTTON_VARIANTS, ["primary", "primary-strong", "secondary", "outline", "destructive-strong", "destructive", "text"]);
  for (const variant of BUTTON_VARIANTS) {
    const classes = buttonClassName({ variant });
    assert.match(classes, /focus-visible:outline-2 focus-visible:outline-offset-2/, variant);
    assert.match(classes, /focus-visible:outline-focus/, variant);
    assert.match(classes, /disabled:cursor-not-allowed/, variant);
    assert.match(classes, /min-h-11/, `${variant} reaches 44px by default`);
    assert.match(classes, /motion-reduce:transition-none/, variant);
  }
});

test("button variants keep the colours each one already had", () => {
  assert.match(buttonClassName({ variant: "primary" }), /bg-action .*hover:bg-action-strong/);
  assert.match(buttonClassName({ variant: "primary-strong" }), /bg-action-strong .*hover:opacity-80/);
  assert.match(buttonClassName({ variant: "secondary" }), /border border-line .*text-accent .*hover:border-line-strong/);
  assert.match(buttonClassName({ variant: "outline" }), /border border-ink\/15 bg-surface .*text-ink hover:bg-ink\/\[0\.03\]/);
  assert.match(buttonClassName({ variant: "destructive" }), /text-destructive hover:bg-destructive-surface\/80 active:bg-destructive active:text-white/);
  assert.match(buttonClassName({ variant: "text" }), /text-accent hover:text-accent-strong/);
  assert.doesNotMatch(buttonClassName({ variant: "text" }), /\bpx-4\b|\bborder\b/, "a text action has no box");
});

test("sizes: md is a 44px target, compact relies on its spacing, icon is a 44px square", () => {
  assert.match(buttonClassName({ size: "md" }), /min-h-11 px-4 py-3/);
  assert.doesNotMatch(buttonClassName({ size: "compact" }), /min-h-11/);
  assert.match(buttonClassName({ size: "icon" }), /h-11 w-11/);
  assert.match(buttonClassName({ surface: "image" }), /focus-visible:outline-white/);
  assert.doesNotMatch(buttonClassName({ surface: "image" }), /outline-focus/);
  assert.match(buttonClassName({ className: "w-full" }), / w-full$/, "the caller's classes are appended");
});

test("Button renders a native button with the caller's attributes and accessible name", () => {
  const html = render(h(Button, { variant: "secondary", type: "submit", disabled: true, "aria-label": "Save hours" }, "Save"));
  assert.match(html, /^<button /);
  assert.match(html, /type="submit"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /aria-label="Save hours"/);
  assert.match(html, />Save<\/button>$/);
  assert.doesNotMatch(render(h(Button, null, "Go")), /type=/, "the native type is left alone");
});

// --- PendingButton ------------------------------------------------------------

test("a pending submit button is disabled, busy, and shows its pending label", () => {
  assert.deepEqual(pendingButtonState({ pending: true, children: "Pay", pendingLabel: "Paying..." }), {
    disabled: true,
    "aria-disabled": true,
    "aria-busy": true,
    label: "Paying...",
  });
  assert.equal(pendingButtonState({ pending: true, children: "Pay" }).label, "Pay", "no pending label keeps the text");
  assert.deepEqual(pendingButtonState({ pending: false, disabled: true, children: "Pay" }), {
    disabled: true,
    "aria-disabled": true,
    "aria-busy": undefined,
    label: "Pay",
  });
  assert.equal(pendingButtonState({ children: "Pay" }).disabled, false);
});

test("the old PendingButton path still renders only its caller's classes", () => {
  const legacy = render(h(LegacyPendingButton, { className: "rounded-lg bg-pink-800 p-3", name: "intent" }, "Continue"));
  assert.ok(
    findTag(legacy, "button", { type: "submit", name: "intent", "aria-disabled": "false", class: "rounded-lg bg-pink-800 p-3" }),
    legacy,
  );
  assert.match(legacy, />Continue<\/button>$/);
  const shared = render(h(PendingButton, { variant: "secondary", className: "min-h-11" }, "Block"));
  assert.match(shared, /type="submit"/);
  assert.match(shared, /class="[^"]*text-accent[^"]*min-h-11"/);
  assert.match(read("src/components/pending-button.jsx"), /from "\.\/ui\/pending-button"/, "one implementation");
});

// --- forms --------------------------------------------------------------------

test("a field ties its label, hint and error to the control", () => {
  const html = render(
    h(Field, { label: "Price", htmlFor: "price", hint: "In pounds", error: "Use pounds." }, (control) =>
      h(Input, { ...control, name: "price", required: true }),
    ),
  );
  assert.match(html, /<label for="price" class="label">Price<\/label>/);
  assert.match(html, /<p id="price-hint"[^>]*>In pounds<\/p>/);
  assert.match(html, /<p id="price-error" class="text-sm text-danger">Use pounds\.<\/p>/);
  assert.ok(
    findTag(html, "input", { id: "price", "aria-invalid": "true", "aria-describedby": "price-hint price-error", required: "" }),
    html,
  );
  assert.doesNotMatch(html, /role="alert"/, "a field error is read with its control, not announced on every keystroke");
});

test("a valid field has no aria-invalid and no dangling description", () => {
  assert.deepEqual(fieldControlProps("name"), { id: "name", "aria-invalid": undefined, "aria-describedby": undefined });
  const html = render(h(Field, { label: "Name", htmlFor: "name" }, (control) => h(Input, control)));
  assert.doesNotMatch(html, /aria-invalid|aria-describedby|name-error/);
});

test("only an optional field says so; required fields carry no marker", () => {
  const optional = render(h(Field, { label: "Notes", htmlFor: "notes", optional: true }, h("textarea", { id: "notes" })));
  assert.match(optional, /Notes<span class="font-normal text-ink-muted"> \(optional\)<\/span><\/label>/);
  const required = render(h(Field, { label: "Name", htmlFor: "name" }, h("input", { id: "name", required: true })));
  assert.doesNotMatch(required, /optional|\*/);
});

test("FormField is the shared Field under its old name", () => {
  assert.equal(FormField, Field);
});

test("form-level errors are alerts, progress is a polite status, and an empty error renders nothing", () => {
  assert.equal(render(h(FormError, null, "Could not save.")), '<p role="alert" class="text-sm text-danger">Could not save.</p>');
  assert.equal(render(h(FormError, null, "")), "");
  assert.match(render(h(FormStatus, null, "Saved")), /^<p role="status" aria-live="polite"/);
});

// --- layout -------------------------------------------------------------------

test("PageContainer is the page's main landmark by default and centres it", () => {
  const html = render(h(PageContainer, null, "x"));
  assert.match(html, /^<main class="container w-full min-w-0 mx-auto max-w-md p-5">x<\/main>$/);
  assert.match(render(h(PageContainer, { as: "div" }, "x")), /^<div /, "no <main> when a layout already has one");
  assert.doesNotMatch(render(h(PageContainer, { align: "start" }, "x")), /mx-auto/);
  assert.match(render(h(PageContainer, { width: "column" }, "x")), /lg:max-w-\[25\.5rem\]/);
  assert.match(render(h(PageContainer, { width: "wide" }, "x")), /max-w-5xl/);
  assert.match(render(h(PageContainer, { width: "prose" }, "x")), /max-w-2xl/);
  assert.match(render(h(PageContainer, { width: "auth" }, "x")), /min-h-screen max-w-sm/);
});

test("PageHeading renders one h1 at the requested size, with a descriptive back link", () => {
  const html = render(
    h(PageHeading, { size: "md", title: "All reviews", back: { href: "/@nails", label: "Nails by Ada" }, description: "Newest first" }),
  );
  assert.equal(count(html, /<h1/g), 1);
  assert.match(classOf(html, "h1"), /^text-2xl font-bold tracking-tighter$/);
  assert.match(html, /<a class="[^"]*min-h-11[^"]*focus-visible:outline-focus[^"]*" href="\/@nails">/);
  assert.match(html, /<span aria-hidden="true">←\u00a0<\/span><span class="sr-only">Back to <\/span>Nails by Ada<\/a>/);
  assert.match(html, /<p class="mt-2 text-sm text-ink-muted">Newest first<\/p>/);
  assert.match(classOf(render(h(PageHeading, { title: "Bookings" })), "h1"), /^text-3xl font-bold tracking-tighter$/);
  assert.match(classOf(render(h(PageHeading, { title: "x", size: "md", tracking: "tight" })), "h1"), /tracking-tight$/);
});

test("SectionHeading is PageHeading with its + New action", () => {
  const html = render(h(SectionHeading, { title: "Add-ons", newHref: "/dashboard/add-ons/new" }));
  assert.equal(count(html, /<h1/g), 1);
  // The "+" is decoration; the link's accessible name is "New".
  assert.match(html, /<h1 class="text-3xl font-bold tracking-tighter">Add-ons<\/h1><a class="[^"]*text-accent[^"]*" href="\/dashboard\/add-ons\/new"><span aria-hidden="true">\+<\/span>New/);
  assert.match(html, /<header class="min-w-0 pt-6">/);
});

test("Card keeps the bordered look; CardLink is one focusable link around one card", () => {
  assert.match(render(h(Card, null, "x")), /^<div class="rounded-xl p-4 border border-line">x<\/div>$/);
  assert.match(render(h(Card, { as: "section", padding: "lg" }, "x")), /^<section class="rounded-2xl p-6 border border-line">/);
  assert.match(render(h(Card, { border: "current" }, "x")), /border border-current/);

  const html = render(h(CardLink, { href: "/account/bookings/1", padding: "sm" }, h("h3", null, "Nails")));
  assert.match(html, /^<a class="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus" href="\/account\/bookings\/1"><article class="rounded-xl p-3 border border-line [^"]*hover:border-line-strong hover:bg-surface-subtle">/);
  assert.equal(count(html, /<a /g), 1, "no nested links");
});

test("EmptyState: muted text inline, the same text in a card when bounded, and an optional action", () => {
  assert.equal(render(h(EmptyState, null, "No reviews yet.")), '<p class="text-sm text-ink-muted">No reviews yet.</p>');
  assert.match(render(h(EmptyState, { variant: "bounded", as: "li" }, "No bookings.")), /^<li class="rounded-xl p-4 border border-line text-sm text-ink-muted">No bookings\.<\/li>$/);
  const withAction = render(h(EmptyState, { action: h("a", { href: "/new" }, "Add one") }, "Nothing yet."));
  assert.match(withAction, /^<div class="text-sm text-ink-muted"><p>Nothing yet\.<\/p><div class="mt-3"><a href="\/new">Add one<\/a><\/div><\/div>$/);
});

test("skeletons announce loading once, hide their blocks, and only pulse without reduced motion", () => {
  const html = render(h(PageSkeleton));
  assert.match(html, /^<main class="container[^"]*mx-auto/);
  assert.match(html, /<div role="status" class="motion-safe:animate-pulse mt-6 flex flex-col"><span class="sr-only">Loading<\/span>/);
  assert.equal(count(html, /aria-hidden="true"/g), 2);
  assert.doesNotMatch(html, /(^|[\s"])animate-pulse/, "never an unconditional pulse");
  assert.doesNotMatch(render(h(PageSkeleton, { align: "start" })), /mx-auto/);
  assert.match(render(h(Skeleton, { rounded: "lg" })), /rounded-lg bg-surface-subtle/);
  assert.equal(count(render(h(SkeletonGroup, null, "x")), /role="status"/g), 1);
});

// --- representative screens -----------------------------------------------------

test("the add-on form proves the form contract without saving anything", () => {
  const html = render(
    h(TreatmentAddOnForm, {
      action: async () => "",
      mode: "create",
      treatments: [{ id: "t1", name: "Gel polish" }],
    }),
  );

  assert.equal(count(html, /<main/g), 1);
  assert.match(html, /<main class="container w-full min-w-0 mx-auto max-w-md p-5">/, "centred on desktop");
  // An untouched form shows no errors yet, but its one submit is disabled
  // until it is valid (empty name, and price and time both zero).
  const name = findTag(html, "input", { id: "name", name: "name", required: "" });
  assert.ok(name && !("aria-invalid" in name), "no error before the provider types");
  assert.doesNotMatch(html, /role="alert"/);
  assert.equal(count(html, /type="submit"/g), 1, "one submit per form");
  assert.ok(findTag(html, "button", { type: "submit", disabled: "" }));
  // The price-or-time rule is a hint tied to both inputs.
  assert.match(html, /<p id="add_on_increase" class="text-sm text-ink-muted">An add-on must add to the price, the time or both\.<\/p>/);
  assert.ok(findTag(html, "input", { id: "additional_price", "aria-describedby": "add_on_increase" }));
  assert.ok(findTag(html, "input", { id: "additional_duration_minutes", "aria-describedby": "add_on_increase" }));
  // Compatible treatments may be left empty (the database accepts none).
  assert.match(html, /<legend class="label">Works with<span class="font-normal text-ink-muted"> \(optional\)<\/span><\/legend>/);
  assert.ok(findTag(html, "input", { type: "checkbox", class: "h-4 w-4", name: "compatibleTreatmentIds", value: "t1" }));
  assert.equal(count(html, /\(optional\)/g), 1, "no other field is optional");
});

test("an add-on's links to archived treatments are shown kept, not offered", () => {
  const html = render(
    h(TreatmentAddOnForm, {
      action: async () => "",
      archiveAction: async () => "",
      restoreAction: async () => "",
      mode: "edit",
      treatments: [{ id: "t1", name: "Gel polish" }],
      addOn: {
        addOnId: "a5", name: "Glitter fade", additional_price: 7, additional_duration_minutes: 15, is_active: false,
        compatibleTreatmentIds: ["t8"], archivedLinkedTreatments: [{ id: "t8", name: "Stiletto sculpt" }],
      },
    }),
  );

  // The archived treatment is visible, ticked and disabled, and never
  // submitted: the database keeps the link when the add-on is saved.
  assert.ok(findTag(html, "input", { type: "checkbox", checked: "", disabled: "" }), "ticked and disabled");
  assert.match(html, /<span>Stiletto sculpt <span class="text-ink-subtle">\(archived treatment\)<\/span>/);
  assert.equal(count(html, /name="compatibleTreatmentIds"/g), 1);
  assert.match(html, /Links to archived treatments are kept when you save/);
});

test("the add-on form's Archive action is the destructive button", () => {
  const html = render(
    h(TreatmentAddOnForm, {
      action: async () => "",
      archiveAction: async () => "",
      restoreAction: async () => "",
      mode: "edit",
      treatments: [],
      addOn: { addOnId: "a1", name: "Nail art", additional_price: 5, additional_duration_minutes: 10, is_active: true, compatibleTreatmentIds: [] },
    }),
  );
  assert.ok(findTag(html, "button", { type: "submit", class: /text-destructive.* w-max$/, "aria-disabled": "false" }));
  assert.match(html, /<button [^>]*text-destructive[^>]*>Archive<\/button>/);
  assert.doesNotMatch(html, /role="alert"/, "a valid add-on shows no form error");
});

test("the not-found and error screens use the shared heading, card and button styles", () => {
  const notFound = render(h(NotFoundContent));
  assert.equal(count(notFound, /<main/g), 1);
  assert.equal(count(notFound, /<h1/g), 1);
  assert.match(notFound, /<section class="rounded-2xl p-6 border border-line mt-6 flex flex-col bg-surface">/);
  assert.match(notFound, /<h1 class="text-2xl font-bold tracking-tight text-ink\/90">That page is not here<\/h1>/);
  assert.match(notFound, /<a class="[^"]*bg-action-strong[^"]*min-h-11[^"]*" href="\/discover">Discover providers<\/a>/);

  const error = render(h(RouteError, { error: Object.assign(new Error("x"), { digest: "abc" }), reset: () => {} }));
  assert.equal(count(error, /<h1/g), 1);
  assert.match(error, /<button class="[^"]*bg-action-strong[^"]*" type="button">Try again<\/button>/);
  assert.match(error, /<a class="[^"]*text-accent hover:text-accent-strong[^"]*min-h-11[^"]*" href="\/account\/bookings">Check my bookings<\/a>/);
});

test("representative pages render exactly one main landmark through PageContainer", () => {
  for (const file of [
    "src/app/(public-provider)/[username]/(storefront)/reviews/page.jsx",
    "src/app/(account)/account/bookings/page.jsx",
    "src/app/(dashboard)/dashboard/add-ons/_components/treatment-add-ons-page.jsx",
    "src/app/(dashboard)/dashboard/add-ons/_components/treatment-add-on-form.jsx",
  ]) {
    const source = read(file);
    assert.doesNotMatch(source, /<main/, `${file} has no hand-written <main>`);
    assert.equal(count(source, /<PageContainer[\s>]/g), 1, `${file} renders one PageContainer`);
  }
  const reviews = read("src/app/(public-provider)/[username]/(storefront)/reviews/page.jsx");
  assert.match(reviews, /<PageContainer width="column">/, "the storefront column width is kept");
});

test("every loading state uses the shared skeleton", () => {
  const loadingFiles = [
    "src/app/(authenticate)/loading.jsx",
    "src/app/(account)/account/loading.tsx",
    "src/app/(site)/discover/loading.jsx",
    "src/app/(dashboard)/dashboard/loading.jsx",
    "src/app/(public-provider)/[username]/book/loading.jsx",
    "src/app/(public-provider)/[username]/(storefront)/loading.jsx",
  ];
  for (const file of loadingFiles) {
    const source = read(file);
    assert.match(source, /from "@\/components\/ui\/skeleton"/, file);
    assert.doesNotMatch(source, /animate-pulse/, `${file} has no hand-written pulse`);
  }
});

// --- boundaries -----------------------------------------------------------------

test("ui primitives depend only on React, Next's Link, react-dom and each other", () => {
  const dir = path.join(REPO_ROOT, "src/components/ui");
  for (const file of readdirSync(dir)) {
    const source = readFileSync(path.join(dir, file), "utf8");
    for (const [, specifier] of source.matchAll(/from\s+["']([^"']+)["']/g)) {
      assert.ok(
        ["react", "react-dom", "next/link"].includes(specifier) || specifier.startsWith("./"),
        `${file} imports ${specifier}`,
      );
    }
  }
});
