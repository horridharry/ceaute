import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  customerBookingView,
  groupProviderBookings,
  isProviderAppointment,
  providerBookingView,
  providerBookingViewFromParam,
} from "../src/lib/bookings/booking-display.js";
import { BookingCard } from "../src/app/(dashboard)/dashboard/_components/booking-card.jsx";
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

test("the customer's own tabs keep Past and hide an ended hold (Specification §10)", () => {
  assert.equal(customerBookingView({ ...expiredHold, confirmed_at: null }, {}, NOW), null);
  assert.equal(customerBookingView({ ...confirmedEnded, confirmed_at: "2026-09-20T10:00:00Z" }, {}, NOW), "past");
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

// Far in the future so it stays an upcoming appointment whenever this runs.
const displayBooking = {
  booking_id: "b1",
  status: "confirmed",
  cancelled_by: null,
  start_at: "2030-09-24T09:00:00Z",
  end_at: "2030-09-24T10:15:00Z",
  customer_name: "Priya Shah",
  treatment_name: "BIAB overlay",
  selected_add_ons: [{ id: "a1" }],
  inspiration_image_count: 2,
  amount_paid_online_pence: 1200,
  amount_due_at_appointment_pence: 3800,
  amount_due_at_appointment_label: "£38.00",
  total_price_pence: 5000,
};
const card = (booking, variant) => renderToStaticMarkup(h("ul", null, h(BookingCard, { booking, variant })));

test("a booking card links to the appointment and leads with time and customer", () => {
  const list = card(displayBooking);
  assert.match(list, /<li><a[^>]*href="\/dashboard\/bookings\/b1"/);
  assert.match(list, /<li><a[^>]*class="[^"]*rounded-xl border border-line/);
  assert.match(list, /10:00 am – 11:15 am/);
  assert.match(list, /Priya Shah/);
  assert.match(list, /BIAB overlay · 1 add-on/);
  assert.match(list, /2 inspiration photos/);
  assert.match(list, /To collect<span[^>]*>£38\.00/);

  const today = card(displayBooking, "today");
  assert.match(today, /10:00 am/);
  assert.doesNotMatch(today, /To collect|Paid in full/, "Today's cards carry no money");
});

// Approved 23 September 2026: money on cards only where accurate, and the
// real refund state on cancelled cards.
test("a booking paid online in full says so; a completed one says nothing about money", () => {
  const paidInFull = { ...displayBooking, amount_paid_online_pence: 5000, amount_due_at_appointment_pence: 0 };
  assert.match(card(paidInFull), />Paid in full</);
  const ended = { ...paidInFull, start_at: "2020-09-24T09:00:00Z", end_at: "2020-09-24T10:15:00Z" };
  assert.doesNotMatch(card(ended), /Paid in full|To collect/);
});

test("a cancelled card shows who cancelled and the refund's actual state", () => {
  const cancelled = { ...displayBooking, status: "cancelled", cancelled_by: "provider", amount_paid_online_pence: 1200, refund_amount_pence: 1200 };
  assert.match(card({ ...cancelled, payment_status: "refunded" }), />By you<[\s\S]*>Refunded £12\.00</);
  assert.match(card({ ...cancelled, payment_status: "refund_required" }), />Refund pending</);
  assert.match(card({ ...cancelled, payment_status: "refund_failed" }), />Refund failed</);
  for (const payment_status of ["refund_required", "refund_failed", "succeeded"]) {
    assert.doesNotMatch(card({ ...cancelled, payment_status }), /Refunded/);
  }
  assert.match(
    card({ ...cancelled, cancelled_by: "customer", refund_amount_pence: 0, payment_status: "succeeded" }),
    />By customer<[\s\S]*>No refund</,
  );
  assert.doesNotMatch(card({ ...cancelled, payment_status: "refunded" }), /To collect/);
});

test("every publication requirement opens the section where it is met", () => {
  const checks = readFileSync("src/app/(dashboard)/dashboard/_lib/publication-checks.js", "utf8");
  const tasks = checks.slice(checks.indexOf("export const SETUP_TASKS"), checks.indexOf("// Why a live page"));
  const hrefs = [...tasks.matchAll(/href: "(\/dashboard[^"]*)"/g)].map(([, href]) => href);
  assert.equal(hrefs.length, 8);
  assert.deepEqual(hrefs, [
    "/dashboard/profile",
    "/dashboard/treatments",
    "/dashboard/profile/portfolio",
    "/dashboard/locations",
    "/dashboard/availability",
    "/dashboard/settings/booking",
    "/dashboard/settings/payments",
    "/dashboard/settings/payments#provider-agreement",
  ]);
  // The agreement link lands on the block that has the id.
  assert.match(
    readFileSync("src/app/(dashboard)/dashboard/settings/payments/page.jsx", "utf8"),
    /id="provider-agreement"/,
  );
});
