import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LocationsPage } from "../src/app/(dashboard)/dashboard/locations/_components/locations-page.jsx";
import { BookingSettingsForm } from "../src/app/(dashboard)/dashboard/settings/booking/_components/booking-settings-form.jsx";

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
  assert.match(html, /Used for new bookings/);
  assert.match(html, /aria-label="Actions for Peckham, London"/);
  assert.match(html, /aria-label="Actions for Mile End, London"/);
  assert.equal(count(html, /<main/g), 1);
  assert.match(html, /Customers see the area\. The full address is shared after they book\./);
});

test("locations: the empty state says what to do", () => {
  const html = render(h(LocationsPage, { locations: [], makePrimaryAction: noop, deleteAction: noop }));
  assert.match(html, /You have not saved a location yet\. Add one so customers can find you and book\./);
});

test("booking settings keeps its fields and ends in one right-aligned Save", () => {
  const html = render(
    h(BookingSettingsForm, {
      settings: { payment_mode: "fixed_deposit", commitment_amount: "15.00", cancellation_window_hours: 24, written_policy: "" },
      updateBookingSettings: noop,
    }),
  );

  for (const label of ["Payment mode", "Deposit amount", "Cancellation window", "Written booking policies"]) {
    assert.match(html, new RegExp(`>${label}</label>`), label);
  }
  assert.match(html, /Customers pay £15\.00 when booking\. If they cancel late, that same amount is retained\./);
  assert.equal(count(html, /type="submit"/g), 1);
  assert.match(html, /justify-end[^>]*><button[^>]*type="submit"[^>]*>Save<\/button>/);
  assert.doesNotMatch(html, /text-red-600/);
  assert.equal(count(html, /<h1/g), 1);
});

test("booking settings reports success as a neutral status, not an error", () => {
  const actions = read("src/app/(dashboard)/dashboard/settings/booking/actions.js");
  assert.match(actions, /return \{ status: "saved", message: "Saved\." \}/);
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

test("availability only gains the shared page frame", () => {
  const form = read("src/app/(dashboard)/dashboard/availability/availability-form.jsx");
  assert.match(form, /<DashboardPage title="Availability">/);
  assert.match(form, /<WeeklyScheduleForm/);
  assert.match(form, /<BlockedDatesForm/);
});
