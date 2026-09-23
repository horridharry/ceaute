import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// Approved 23 September 2026: booking details lead with the appointment and
// its actions; the receipt moves lower but keeps every amount and refund
// state. No Get directions.
const provider = readFileSync("src/app/(dashboard)/dashboard/bookings/[bookingId]/page.jsx", "utf8");
const customer = readFileSync("src/app/(account)/account/bookings/[bookingId]/page.jsx", "utf8");
const order = (source, names) => names.map((name) => source.indexOf(name));
const ascending = (positions) => positions.every((value, index) => value > -1 && (index === 0 || value > positions[index - 1]));

test("provider detail: summary, contact, inspiration, payment, policy, cancel, in that order", () => {
  const render = provider.slice(provider.indexOf("export default async function"));
  assert.ok(
    ascending(order(render, ["<StatusLine", "<Summary", "<Contact", "Inspiration", "<Payment", "Cancellation policy", "<CancelBooking"])),
  );
  assert.doesNotMatch(render, /title="Customer"|title="Treatment"/, "no separate Customer or Treatment sections");
});

test("provider detail keeps every money row and refund state", () => {
  for (const row of ['"Paid online"', '"Refunded"', '"Kept"', '"To collect"', '"Total"', "refund_status_label", "Automatic refund failed"]) {
    assert.ok(provider.includes(row), row);
  }
  assert.match(provider, /snapshotPriceLines\(booking\.service_snapshot\)/);
});

test("customer detail: summary, photos, payment, cancellation, cancel, review", () => {
  const render = customer.slice(customer.indexOf("export default async function"));
  assert.ok(
    ascending(order(render, ["<StatusLine", "<Summary", "<BookingInspirationImages", "<Payment", "<Cancellation", "<CancelBooking", "<Review"])),
  );
  for (const row of ['"Paid online"', '"Refund"', "`Kept by ${booking.provider_name}`", "at the appointment", '"Total"']) {
    assert.ok(customer.includes(row), row);
  }
});

test("no Get directions anywhere, and the exact-address rule is unchanged", () => {
  for (const source of [provider, customer]) {
    assert.doesNotMatch(source, /directions|maps\.google|google\.com\/maps/i);
    assert.match(
      source,
      /const canShowExactAddress = \(booking\) =>\s*Boolean\(booking\.confirmed_at\) &&\s*\(booking\.status === "confirmed" \|\| booking\.status === "completed"\);/,
    );
  }
});
