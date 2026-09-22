import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The storefront's privacy and preview rules, pinned on the source because
// the pages cannot be rendered here:
// - only the public area of a location is read, never the exact address;
// - only visible portfolio images are read;
// - the owner's preview renders the storefront without booking entry.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) =>
  readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/\/\/.*$/gm, "");

const viewModel = read("src/features/storefront/storefront-view-model.js");
const storefrontPage = read("src/features/storefront/storefront-page.jsx");
const previewPage = read("src/app/(dashboard)/dashboard/profile/preview/page.jsx");

function querySelecting(source, table) {
  const start = source.indexOf(`.from("${table}")`);
  assert.ok(start >= 0, `${table} is queried`);
  const select = source.slice(start).match(/\.select\(\s*"([^"]*)"/);
  return select[1];
}

test("the storefront reads only the public area of the working location", () => {
  assert.equal(querySelecting(viewModel, "provider_location"), "public_area");
  assert.doesNotMatch(viewModel, /address|postcode|street|access_instructions|latitude|longitude/i);
});

test("the storefront reads only visible portfolio images", () => {
  const start = viewModel.indexOf('.from("portfolio_image")');
  const query = viewModel.slice(start, viewModel.indexOf(".order(", start));
  assert.match(query, /\.eq\("is_visible", true\)/);
});

test("the owner preview renders the storefront without booking entry", () => {
  assert.match(previewPage, /<StorefrontPage[\s\S]*backHref="\/dashboard\/profile"/);
  assert.match(storefrontPage, /bookingEnabled=\{!backHref\}/);
  assert.match(
    storefrontPage,
    /if \(bookingEnabled\) \{\s*return <TreatmentSelectionList/,
    "only the bookable variant renders the selection list that links into booking",
  );
});
