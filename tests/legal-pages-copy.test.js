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
