import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  categorizeBooking,
  groupProviderBookings,
  isProviderAppointment,
  providerBookingView,
  providerBookingViewFromParam,
} from "../src/lib/bookings/booking-display.js";
import { BookingRow } from "../src/app/(dashboard)/dashboard/_components/booking-row.jsx";
import {
  formatClockTime,
  formatShortDate,
  formatTimeRange,
  treatmentLine,
} from "../src/app/(dashboard)/dashboard/_lib/booking-format.js";
import {
  providerCancellationFailure,
  providerCancellationSuccess,
} from "../src/app/(dashboard)/dashboard/bookings/_lib/cancel-outcome.js";

const NOW = new Date("2026-09-22T08:00:00Z");
const at = (iso) => ({ start_at: iso, end_at: new Date(new Date(iso).getTime() + 3600_000).toISOString() });

const confirmedFuture = { id: "b3", status: "confirmed", cancelled_by: null, ...at("2026-09-23T10:00:00Z") };
const confirmedEnded = { id: "b7", status: "confirmed", cancelled_by: null, ...at("2026-09-21T10:00:00Z") };
const completed = { id: "b6", status: "completed", cancelled_by: null, ...at("2026-09-21T15:00:00Z") };
const cancelledByCustomer = { id: "b9", status: "cancelled", cancelled_by: "customer", ...at("2026-09-25T14:00:00Z") };
const cancelledByProvider = { id: "b10", status: "cancelled", cancelled_by: "provider", ...at("2026-09-17T08:00:00Z") };
const unpaidHold = { id: "h1", status: "awaiting_payment", cancelled_by: null, ...at("2026-09-25T09:00:00Z") };
const unpaidHoldPastExpiry = { id: "h1b", status: "awaiting_payment", cancelled_by: null, ...at("2026-09-21T09:00:00Z") };
const expiredHold = { id: "h2", status: "cancelled", cancelled_by: null, ...at("2026-09-23T15:00:00Z") };
// A payment that lands after the hold expired is refunded automatically;
// complete_booking_payment_attempt leaves the booking cancelled with no
// cancelled_by (202609130008), so it looks exactly like an expired hold.
const latePaidExpiredHold = { id: "h3", status: "cancelled", cancelled_by: null, payment_status: "refund_required", ...at("2026-09-29T12:00:00Z") };

test("appointments map to Upcoming, Completed and Cancelled by their real status", () => {
  assert.equal(providerBookingView(confirmedFuture, NOW), "upcoming");
  assert.equal(providerBookingView(confirmedEnded, NOW), "completed", "over, before the completion job runs");
  assert.equal(providerBookingView(completed, NOW), "completed");
  assert.equal(providerBookingView(cancelledByCustomer, NOW), "cancelled");
  assert.equal(providerBookingView(cancelledByProvider, NOW), "cancelled");
});

test("holds are in no appointment filter: unpaid, expired and late-paid", () => {
  for (const hold of [unpaidHold, unpaidHoldPastExpiry, expiredHold, latePaidExpiredHold]) {
    assert.equal(providerBookingView(hold, NOW), null, hold.id);
    assert.equal(isProviderAppointment(hold), false, hold.id);
  }
  assert.equal(providerBookingView({ status: "something_new" }, NOW), null, "an unknown status is not guessed");
});

test("an unpaid hold is never an upcoming appointment, an expired hold never a cancellation", () => {
  const groups = groupProviderBookings(
    [unpaidHold, confirmedFuture, expiredHold, latePaidExpiredHold, cancelledByCustomer, completed, confirmedEnded, cancelledByProvider],
    NOW,
  );

  assert.deepEqual(groups.upcoming.map((booking) => booking.id), ["b3"]);
  assert.deepEqual(groups.completed.map((booking) => booking.id), ["b6", "b7"], "newest first");
  assert.deepEqual(groups.cancelled.map((booking) => booking.id), ["b9", "b10"], "newest first");
  assert.equal(groups.upcoming.length + groups.completed.length + groups.cancelled.length, 5, "counts exclude the three holds");
});

test("upcoming appointments are soonest first", () => {
  const later = { ...confirmedFuture, id: "later", ...at("2026-09-26T13:00:00Z") };
  const sooner = { ...confirmedFuture, id: "sooner", ...at("2026-09-22T09:00:00Z") };
  assert.deepEqual(groupProviderBookings([later, sooner], NOW).upcoming.map((booking) => booking.id), ["sooner", "later"]);
});

test("the customer's own booking tabs are unchanged", () => {
  assert.equal(categorizeBooking(expiredHold, NOW), "cancelled");
  assert.equal(categorizeBooking(confirmedEnded, NOW), "previous");
});

test("old ?view=previous links land on Completed; anything unknown on Upcoming", () => {
  assert.equal(providerBookingViewFromParam("previous"), "completed");
  assert.equal(providerBookingViewFromParam("cancelled"), "cancelled");
  assert.equal(providerBookingViewFromParam(undefined), "upcoming");
  assert.equal(providerBookingViewFromParam("holds"), "upcoming");
});

test("a hold's detail URL is Not found on the server, not just hidden in lists", () => {
  const queries = readFileSync("src/app/(dashboard)/dashboard/bookings/queries.js", "utf8");
  assert.match(queries, /if \(!booking \|\| !isProviderAppointment\(booking\)\) \{\s*return null;/);
  const page = readFileSync("src/app/(dashboard)/dashboard/bookings/[bookingId]/page.jsx", "utf8");
  assert.match(page, /if \(!booking\) \{\s*notFound\(\);/);
  const loader = readFileSync("src/lib/bookings/provider-booking-groups.js", "utf8");
  assert.match(loader, /groupProviderBookings\(/, "lists and counts are filtered on the server");
});

test("the Availability hold counts are untouched", () => {
  const counts = readFileSync("src/app/(dashboard)/dashboard/availability/queries.js", "utf8");
  assert.doesNotMatch(counts, /providerBookingView|groupProviderBookings/);
});

test("cancellation messages never overclaim", () => {
  assert.deepEqual(providerCancellationSuccess("Priya Shah"), {
    status: "cancelled",
    message: "Booking cancelled. Priya will be refunded the amount paid online.",
  });
  assert.equal(providerCancellationFailure({ message: "Past bookings cannot be cancelled." }).message, "Past bookings cannot be cancelled.");
  assert.equal(
    providerCancellationFailure({ message: "stripe exploded" }).message,
    "Couldn’t finish cancelling. Refresh to see the booking’s current status.",
  );
});

test("the provider's cancel action returns its outcome instead of throwing", () => {
  const actions = readFileSync("src/app/(dashboard)/dashboard/bookings/actions.js", "utf8");
  assert.match(actions, /export const cancelProviderBooking = async \(_currentState, formData\)/);
  assert.match(actions, /actor: "provider"/);
  assert.match(actions, /return providerCancellationFailure\(error\)/);
  assert.doesNotMatch(actions, /throw /);
});

test("booking times are 12-hour London times", () => {
  assert.equal(formatClockTime("2026-09-22T13:30:00Z"), "2:30 pm");
  assert.equal(formatTimeRange("2026-09-22T09:00:00Z", "2026-09-22T10:15:00Z"), "10:00 am – 11:15 am");
  assert.equal(formatShortDate("2026-09-23T10:00:00Z"), "Wed 23 Sept");
  assert.equal(treatmentLine({ treatment_name: "BIAB overlay", selected_add_ons: [{}] }), "BIAB overlay · 1 add-on");
});

const displayBooking = {
  booking_id: "b1",
  status: "confirmed",
  cancelled_by: null,
  start_at: "2026-09-22T09:00:00Z",
  end_at: "2026-09-22T10:15:00Z",
  customer_name: "Priya Shah",
  treatment_name: "BIAB overlay",
  selected_add_ons: [{ id: "a1" }],
  inspiration_image_count: 2,
  amount_due_at_appointment_pence: 3800,
  amount_due_at_appointment_label: "£38.00",
};

test("a booking row links to the appointment and shows what the provider needs", () => {
  const list = renderToStaticMarkup(h("ul", null, h(BookingRow, { booking: displayBooking })));
  assert.match(list, /href="\/dashboard\/bookings\/b1"/);
  assert.match(list, /10:00 am – 11:15 am/);
  assert.match(list, /Priya Shah/);
  assert.match(list, /BIAB overlay · 1 add-on/);
  assert.match(list, /2 inspiration photos/);
  assert.match(list, /To collect<span[^>]*>£38\.00/);

  const cancelled = renderToStaticMarkup(h("ul", null, h(BookingRow, { booking: { ...displayBooking, status: "cancelled", cancelled_by: "provider" } })));
  assert.match(cancelled, />By you</);
  assert.doesNotMatch(cancelled, /To collect/);

  const today = renderToStaticMarkup(h("ul", null, h(BookingRow, { booking: displayBooking, variant: "today" })));
  assert.match(today, /10:00 am/);
  assert.doesNotMatch(today, /To collect/);
});

test("every publication requirement opens the section where it is met", () => {
  const readiness = readFileSync("src/app/(dashboard)/dashboard/_lib/publication-readiness.js", "utf8");
  const hrefs = [...readiness.matchAll(/"(\/dashboard[^"]*)"/g)].map(([, href]) => href);
  assert.equal(hrefs.length, 10);
  assert.deepEqual([...new Set(hrefs)].sort(), [
    "/dashboard/availability",
    "/dashboard/locations",
    "/dashboard/profile",
    "/dashboard/profile/portfolio",
    "/dashboard/settings/booking",
    "/dashboard/settings/payments",
    "/dashboard/treatments",
  ]);
});
