import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Pins the availability-related copy on /terms and /privacy after drops
// replaced weekly opening hours and blocked dates. See
// docs/decisions/007-availability-released-in-drops.md.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) =>
  readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

const terms = read("src/app/(site)/terms/page.tsx");
const privacy = read("src/app/(site)/privacy/page.tsx");

test("Terms describes providers choosing their own dates and times", () => {
  assert.match(
    terms,
    /and choose which dates and times to open for\s+booking, and when\./,
  );
  assert.match(
    terms,
    /Ceaute does not check or guarantee that any of it\s+is accurate\./,
  );
});

test("Terms states the new appointment rule", () => {
  assert.match(
    terms,
    /Appointments must start at least 24 hours ahead, on a date the\s+provider has opened for booking, at a start time the provider\s+offers\. All times are London time\./,
  );
});

test("Privacy describes the dates and times a provider opens for booking", () => {
  assert.match(
    privacy,
    /the dates and times you open for booking,\s+and when they open/,
  );
});

test("neither page still mentions blocked dates, the 60-day window or working hours", () => {
  for (const [name, text] of [
    ["terms", terms],
    ["privacy", privacy],
  ]) {
    assert.doesNotMatch(text, /blocked dates/, `${name} still says blocked dates`);
    assert.doesNotMatch(text, /60 days/, `${name} still says 60 days`);
    // The Terms payout section's "a few working days to appear" is unaffected;
    // match "working hours" only, not "working days".
    assert.doesNotMatch(text, /working hours/, `${name} still says working hours`);
  }
});

// Pins the approved /terms wording for flat deposits. See
// docs/decisions/008-flat-deposit.md and task T6 of
// docs/reports/2026-09-27-flat-deposit-plan.md.

const normalise = (text) => text.replace(/\s+/g, " ");

test("Terms describes a deposit as a fixed amount or a percentage", () => {
  assert.match(
    terms,
    /A\s+deposit\s+is\s+either\s+a\s+fixed\s+amount\s+set\s+by\s+the\s+provider,\s+of\s+at\s+least\s+£1/,
  );
  assert.match(
    terms,
    /A\s+deposit\s+is\s+never\s+more\s+than\s+the\s+booking\s+price\./,
  );
  assert.ok(
    normalise(terms).includes(
      "Each provider chooses whether customers pay the full price when booking or a deposit. A deposit is either a fixed amount set by the provider, of at least £1, or a percentage of the booking price between 10% and 90% and at least £1. A deposit is never more than the booking price. Checkout shows which applies, how much is due now, and how much is due at the appointment.",
    ),
    "terms does not carry the approved Paying paragraph",
  );
});

test("Terms describes what a provider keeps after a late cancellation", () => {
  assert.match(
    terms,
    /keeps\s+the\s+amount\s+shown\s+to\s+you\s+at\s+checkout,\s+never\s+more\s+than\s+you\s+paid\s+online/,
  );
  assert.match(terms, /With\s+a\s+deposit\s+that\s+is\s+the\s+whole\s+deposit/);
  assert.ok(
    normalise(terms).includes(
      "<strong>Cancel after the deadline</strong> and the provider keeps the amount shown to you at checkout, never more than you paid online. With a deposit that is the whole deposit; with full payment it is the percentage the provider set. Anything you paid above that is refunded. Bookings keep the terms they were made on.",
    ),
    "terms does not carry the approved late-cancellation wording",
  );
});

test("Terms no longer carries the percentage-only wording and keeps its date", () => {
  assert.doesNotMatch(
    terms,
    /The\s+percentage\s+is\s+worked\s+out\s+to\s+the\s+nearest\s+penny/,
  );
  assert.doesNotMatch(terms, /Bookings\s+made\s+before\s+percentages\s+were\s+introduced/);
  assert.match(terms, /updated="28 September 2026"/);
});
