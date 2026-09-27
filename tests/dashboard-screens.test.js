import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LocationsPage } from "../src/app/(dashboard)/dashboard/locations/_components/locations-page.jsx";
import { BookingSettingsForm } from "../src/app/(dashboard)/dashboard/settings/booking/_components/booking-settings-form.jsx";
import { AvailabilityForm } from "../src/app/(dashboard)/dashboard/availability/availability-form.jsx";
import { namedDrops } from "../src/app/(dashboard)/dashboard/availability/_lib/drop-form.js";

// Screen-level guarantees of the dashboard redesign, rendered with fixtures.
const render = (element) => renderToStaticMarkup(element);
const count = (html, pattern) => (html.match(pattern) ?? []).length;
const read = (path) => readFileSync(path, "utf8");
const noop = async () => ({ status: "done", message: "" });

const locations = [
  { id: "l1", public_area: "Peckham, London", address_line_1: "14 Bellenden Road", address_line_2: "", city: "London", postcode: "SE15 4RF", is_primary: true },
  { id: "l2", public_area: "Mile End, London", address_line_1: "Mile End Road", address_line_2: "", city: "London", postcode: "E1 4NS", is_primary: false },
];

test("locations: every card is white and the primary one carries a compact badge", () => {
  const html = render(h(LocationsPage, { locations, makePrimaryAction: noop, deleteAction: noop }));

  assert.doesNotMatch(html, /(?<!hover:)bg-pink-50|border-pink-200|Working here now/);
  assert.equal(count(html, /<li class="[^"]*border-line bg-surface/g), 2);
  assert.equal(count(html, />Primary<\/span>/g), 1);
  // Shortened 23 September 2026: no "Used for new bookings", no footer line,
  // and Primary is a plain badge without the attention dot.
  assert.doesNotMatch(html, /Used for new bookings|Confirmed bookings keep their original address/);
  assert.doesNotMatch(html, /rounded-full bg-action/);
  assert.match(html, /aria-label="Actions for Peckham, London"/);
  assert.match(html, /aria-label="Actions for Mile End, London"/);
  assert.equal(count(html, /<main/g), 1);
  assert.match(html, /Customers see the area until they book\./);
});

test("locations: the empty state says what to do", () => {
  const html = render(h(LocationsPage, { locations: [], makePrimaryAction: noop, deleteAction: noop }));
  assert.match(html, /You have not saved a location yet\. Add one so customers can find you and book\./);
});

test("booking settings keeps its fields and ends in one right-aligned Save", () => {
  const html = render(
    h(BookingSettingsForm, {
      settings: {
        payment_mode: "deposit",
        deposit_percent: "30",
        cancellation_window_hours: 24,
        written_policy: "",
        legacy: null,
        pageStatus: "draft",
      },
      updateBookingSettings: noop,
    }),
  );

  assert.match(html, /<legend[^>]*>Payment when booking<\/legend>/);
  for (const label of ["Deposit percentage", "Free cancellation until"]) {
    assert.match(html, new RegExp(`>${label}</label>`), label);
  }
  assert.match(html, />Written booking policy<span[^>]*> \(optional\)<\/span><\/label>/);
  // Percentages step by 5 up to 90% for a deposit; there is no 0%.
  assert.match(html, /<option value="10">10%<\/option>/);
  assert.match(html, /<option value="90">90%<\/option>/);
  assert.doesNotMatch(html, /<option value="95">|<option value="100">|<option value="0">/);
  assert.match(html, /Customers pay 30% of the booking price when they book, and at least\s+£1\./);
  assert.match(html, /On a £40\.00 booking: £12\.00 now, £28\.00 at the appointment\./);
  assert.equal(count(html, /type="submit"/g), 1);
  assert.match(html, /justify-end[\s\S]*<button[^>]*type="submit"[^>]*>Save<\/button>/);
  assert.doesNotMatch(html, /text-red-600/);
  assert.equal(count(html, /<h1/g), 1);
});

test("booking settings explains full payment with the amount kept after a late cancellation", () => {
  const html = render(
    h(BookingSettingsForm, {
      settings: {
        payment_mode: "full",
        deposit_percent: "50",
        cancellation_window_hours: 48,
        written_policy: "",
        legacy: null,
        pageStatus: "draft",
      },
      updateBookingSettings: noop,
    }),
  );

  assert.match(html, />Kept after a late cancellation<\/label>/);
  assert.match(html, /<option value="100">100%<\/option>/);
  assert.match(html, /Customers pay the full price when they book\. If they cancel less than\s*(<!-- -->)?48/);
  assert.match(html, /a late cancellation keeps\s*(<!-- -->)?£20\.00(<!-- -->)? and refunds £20\.00/);
});

test("booking settings saved before percentages asks for one and says what is paused", () => {
  const html = render(
    h(BookingSettingsForm, {
      settings: {
        payment_mode: "full",
        deposit_percent: "",
        cancellation_window_hours: 24,
        written_policy: "",
        legacy: { paymentMode: "fixed_deposit", amountPence: 4500 },
        pageStatus: "published",
      },
      updateBookingSettings: noop,
    }),
  );

  assert.match(html, /Choose a percentage/);
  assert.match(html, /Your old £45\.00 deposit(<!-- -->)? no longer\s+applies to new bookings/);
  assert.match(html, /your page isn(’|&#x27;|')t taking new bookings until you save a percentage/);
  assert.match(html, /Bookings already made keep their\s+terms\./);
  assert.match(html, /Choose a percentage to see what customers pay\./);
});

test("booking settings reports success as a neutral status, not an error", () => {
  const actions = read("src/app/(dashboard)/dashboard/settings/booking/actions.js");
  assert.match(actions, /return \{ status: "saved", message: "Saved\.", fieldErrors: \{\} \}/);
  const form = read("src/app/(dashboard)/dashboard/settings/booking/_components/booking-settings-form.jsx");
  assert.match(form, /<FormActions status=\{result\?\.status === "saved"/);
});

test("payments keeps every fee and refund fact, just collapsed", () => {
  const page = read("src/app/(dashboard)/dashboard/settings/payments/page.jsx");
  for (const text of [
    "Example £50 online payment",
    "Stripe processing estimate",
    "Ceaute fee (2%)",
    "You receive",
    "The Stripe estimate uses its UK rate of 1.5% + 20p",
    "There is no monthly",
    "Early customer cancellation: full refund",
    "Late customer cancellation: your policy decides what you keep",
    "Provider cancellation: full customer refund; you cover Stripe processing.",
    "Bookings paused.",
    "Stripe is not configured on this environment.",
    "Required by Stripe",
  ]) {
    assert.ok(page.includes(text), text);
  }
  assert.match(page, /<Disclosure summary="Fees and refunds"/);
  assert.match(page, /defaultOpen=\{requirements\.length > 0\}/);
  assert.doesNotMatch(page, /within a few days/);
});

test("availability lists drops and drops the weekly editor", () => {
  const form = read("src/app/(dashboard)/dashboard/availability/availability-form.jsx");
  assert.match(form, /title="Availability"/);
  assert.match(form, /<DropList/);
  assert.match(form, /No dates yet\./);
  assert.doesNotMatch(form, /WeeklyScheduleForm|BlockedDatesForm|Close every day/);
});

// Adding or editing a drop has its own page, so browser Back from the editor
// returns to the list (usability test, 27 September 2026).
const dropFixture = (id, localDate, opensAt) => ({
  id,
  opensAt,
  dates: [{ local_date: localDate, hours_start: "09:00", hours_end: "17:00", start_times: null }],
});

test("availability list links to each drop's own edit page and to Add dates, with no editor", () => {
  const drops = namedDrops([
    dropFixture("drop-1", "2026-10-18", "2026-09-01T09:00:00Z"),
    dropFixture("drop-2", "2026-11-08", "2026-10-01T09:00:00Z"),
  ]);
  const html = render(
    h(AvailabilityForm, { drops, bookingCountRows: [], isPublished: true, now: Date.parse("2026-09-27T09:00:00Z") }),
  );

  for (const drop of drops) {
    assert.match(
      html,
      new RegExp(
        `<a(?=[^>]*href="/dashboard/availability/${drop.id}/edit")(?=[^>]*aria-label="Edit ${drop.name}")[^>]*>Edit</a>`,
      ),
    );
  }
  assert.equal(count(html, /href="\/dashboard\/availability\/new"/g), 1);
  assert.match(html, />Add dates<\/a>/);
  assert.doesNotMatch(html, /<button|<form|Drop time|Set times|>Saved</);
  assert.doesNotMatch(html, /Customers can&#x27;t book/);

  const dir = "src/app/(dashboard)/dashboard/availability";
  const listSources = [
    read(`${dir}/page.jsx`),
    read(`${dir}/availability-form.jsx`),
    read(`${dir}/_components/drop-list.jsx`),
  ].join("\n");
  assert.doesNotMatch(listSources, /DropEditor|editingId|onEdit|NEW_DROP|saveDrop|"use client"/);
});

test("availability with no drops keeps its notice and empty state, linking to Add dates", () => {
  const html = render(h(AvailabilityForm, { drops: [], bookingCountRows: [], isPublished: true, now: 0 }));

  assert.match(html, /Customers can&#x27;t book: you have no open dates\./);
  assert.match(html, /No dates yet\./);
  assert.match(html, /<a[^>]*href="\/dashboard\/availability\/new"[^>]*>Add dates<\/a>/);
});

test("adding and editing a drop are their own pages with a way back to Availability", () => {
  const dir = "src/app/(dashboard)/dashboard/availability";
  const newPage = read(`${dir}/new/page.jsx`);
  const editPage = read(`${dir}/[dropId]/edit/page.jsx`);
  const editor = read(`${dir}/_components/drop-editor.jsx`);
  const actions = read(`${dir}/actions.js`);

  for (const page of [newPage, editPage]) {
    assert.match(page, /back=\{\{ href: "\/dashboard\/availability", label: "Availability" \}\}/);
    assert.match(page, /<DropEditor/);
    assert.match(page, /getDrops\(\)/);
  }
  assert.match(newPage, /title="Add dates"/);
  assert.match(newPage, /next: "\/dashboard\/availability\/new"/);
  assert.match(editPage, /title=\{drop\.name\}/);
  assert.match(editPage, /description=\{dropStatusLine\(drop, now\)\}/);
  assert.match(editPage, /next: `\/dashboard\/availability\/\$\{dropId\}\/edit`/);
  assert.match(editPage, /if \(!drop\) \{\s*notFound\(\);/);

  // Save goes back to the list; errors stay on the editor with the input.
  assert.match(actions, /redirect\("\/dashboard\/availability", RedirectType\.replace\);\n\};\s*$/);
  assert.doesNotMatch(actions, /status: "saved"/);
  assert.match(actions, /return \{ status: "error", message: saveErrorMessage\(error\) \}/);

  // The guard stands down on submit, comes back on an error, and Cancel is a
  // link the guard can ask about.
  assert.match(editor, /useUnsavedChanges\(\s*isDraftDirty\(draft, baseline\) && !released,?\s*\)/);
  assert.match(editor, /onSubmit=\{\(\) => \{\s*allowNextNavigation\(\);\s*setReleased\(true\);/);
  assert.match(editor, /await saveDrop\(null, formData\);\s*setReleased\(false\);/);
  assert.match(editor, /<Link\s+href="\/dashboard\/availability"[^>]*>\s*Cancel\s*<\/Link>/);
  assert.match(editor, /export function DropEditor\(\{ drop, drops, countsByDate, today, now, saveDrop \}\)/);
  assert.doesNotMatch(editor, /onSaved|rootRef/);
});

test("availability shows each drop as one card and types times instead of choosing from a list", () => {
  const dir = "src/app/(dashboard)/dashboard/availability";
  const list = read(`${dir}/_components/drop-list.jsx`);
  const editor = read(`${dir}/_components/drop-editor.jsx`);
  const timeInput = read(`${dir}/_components/time-input.jsx`);

  assert.match(list, /dropSummaryLine\(drop\)/);
  assert.match(list, /formatDropBookingsLine\(drop\.dates, countsByDate\)/);
  assert.doesNotMatch(list, /formatDateLabel|drop\.dates\.map/);
  assert.match(editor, /formatDateBookingsLine\(countsByDate\[date\.local_date\]\)/);
  assert.doesNotMatch(editor, /<Select|TIME_OPTIONS/);
  assert.equal((editor.match(/<TimeInput/g) ?? []).length, 4);
  for (const attribute of [
    'role="combobox"',
    "aria-expanded=",
    "aria-controls=",
    'aria-autocomplete="list"',
    "aria-activedescendant=",
    'role="listbox"',
    'role="option"',
    'autoComplete="off"',
    "min-h-11",
  ]) {
    assert.ok(timeInput.includes(attribute), attribute);
  }
});
