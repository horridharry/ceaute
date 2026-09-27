import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { summaryFromRows, openForBookingSentence, opensSentence } from "../src/lib/availability/drops.js";

// The storefront's Availability section, pinned on the source because the
// pages cannot be rendered here:
// - the view model reads the drop summary through one shared query;
// - no storefront source reads the availability tables directly - it only
//   describes what get_public_availability_summary already decided;
// - the section still renders last, and only while the page is taking
//   bookings and something is open or coming;
// - the section never uses the provider's own words for a drop or a slot.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) =>
  readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/\/\/.*$/gm, "");

const viewModel = read("src/features/storefront/storefront-view-model.js");
const storefront = read("src/features/storefront/storefront-page.jsx");
const STOREFRONT_DIR = path.join(REPO_ROOT, "src/features/storefront");

test("the view model reads the drop summary through the shared query", () => {
  assert.match(viewModel, /availabilitySummaryQuery\(supabase, providerPage\.id\)/);
  assert.match(viewModel, /availability: summaryFromRows\(availabilityResult\.data\)/);
});

test("no storefront source reads the availability tables directly", () => {
  for (const file of readdirSync(STOREFRONT_DIR)) {
    if (!file.endsWith(".js") && !file.endsWith(".jsx")) {
      continue;
    }
    const source = read(path.join("src/features/storefront", file));
    assert.doesNotMatch(
      source,
      /\.from\("availability_date"\)|\.from\("availability_drop"\)/,
      `${file} never reads the availability tables directly`,
    );
  }
});

test("Availability still renders last, only while the page is taking bookings", () => {
  const body = storefront.slice(storefront.indexOf("export function StorefrontPage"));
  assert.ok(
    body.indexOf("<ReviewsPreview") < body.indexOf("<Availability"),
    "Availability comes after Reviews",
  );
  assert.equal(
    body.slice(body.indexOf("<Availability")).split("</div>")[0].includes("<section"),
    false,
    "nothing follows Availability inside the stack",
  );
  assert.match(
    storefront,
    /\{takingBookings && \(availability\.open\.length > 0 \|\| availability\.next\) \? \(/,
    "the render condition includes takingBookings",
  );
});

test("the Availability component's own text never says drop, slot or uses an em dash", () => {
  const section = storefront.slice(
    storefront.indexOf("function Availability"),
    storefront.indexOf("// Storefront sections are separated"),
  );
  assert.doesNotMatch(section, /\bdrop\b/i);
  assert.doesNotMatch(section, /\bslot\b/i);
  assert.doesNotMatch(section, /—/);
  assert.match(section, /openForBookingSentence\(open\)/);
  assert.match(section, /opensSentence\(next\.name, next\.opensAt\)/);
});

test("summaryFromRows and the sentences read an open month and an upcoming month", () => {
  const { open, next } = summaryFromRows([
    {
      drop_month: "2026-10-01",
      first_date: null,
      last_date: null,
      opens_at: null,
      is_open: true,
    },
    {
      drop_month: "2026-11-01",
      first_date: null,
      last_date: null,
      opens_at: "2026-10-15T18:00:00Z",
      is_open: false,
    },
  ]);

  assert.equal(openForBookingSentence(open), "October slots are open for booking");
  assert.equal(opensSentence(next.name, next.opensAt), "November slots open on 15 October at 7 pm");
});

test("an upcoming drop named by its range reads with the range in the sentence", () => {
  const { open, next } = summaryFromRows([
    {
      drop_month: null,
      first_date: "2026-11-01",
      last_date: "2026-11-14",
      opens_at: "2026-10-15T18:00:00Z",
      is_open: false,
    },
  ]);

  assert.deepEqual(open, []);
  assert.equal(opensSentence(next.name, next.opensAt), "1–14 November slots open on 15 October at 7 pm");
});
