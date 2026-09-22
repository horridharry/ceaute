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
const portfolioPhotos = read("src/features/storefront/portfolio-photos.js");
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

test("the storefront reads only visible portfolio images, through the shared query", () => {
  const start = portfolioPhotos.indexOf('.from("portfolio_image")');
  const query = portfolioPhotos.slice(start, portfolioPhotos.indexOf(".order(", start));
  assert.match(query, /\.eq\("is_visible", true\)/);
  assert.match(viewModel, /visiblePortfolioQuery\(supabase, providerPage\.id\)/);
  assert.doesNotMatch(viewModel, /\.from\("portfolio_image"\)/, "no second, divergent portfolio query");
});

test("the owner preview renders the storefront without booking entry or All treatments", () => {
  assert.match(previewPage, /<StorefrontPage[\s\S]*backHref="\/dashboard\/profile"/);
  assert.match(storefrontPage, /const publicView = !backHref;/);
  assert.match(storefrontPage, /const bookingUsername = publicView \? provider\.username : null;/);
  assert.match(storefrontPage, /<TreatmentsPreview[\s\S]*?username=\{bookingUsername\}/);
  assert.match(
    storefrontPage,
    /\{username \? \(\s*<TreatmentSelectionList/,
    "only the public page renders the selection list that links into booking",
  );
  assert.match(
    storefrontPage,
    /\{username && hasMoreTreatments\(sections\) \? \(\s*<Link\s+href=\{treatmentsHref\(username\)\}/,
    "See all treatments appears only on the public page, and only above three",
  );
});

test("treatments are read once, through the shared queries, and the All treatments page reads no address", () => {
  const queries = read("src/features/storefront/treatment-queries.js");
  assert.match(viewModel, /treatmentQueries\(supabase, providerPage\.id\)/);
  assert.doesNotMatch(viewModel, /\.from\("treatment/, "no second, divergent treatment query");
  assert.doesNotMatch(queries, /address|postcode|access_instructions/i);
  const page = read("src/app/(public-provider)/[username]/(storefront)/treatments/page.jsx");
  assert.match(page, /loadTreatmentSections\(/);
  assert.doesNotMatch(page, /\.from\(|address|postcode/i);
});

test("public photo queries read only the id, storage path and caption, and the browser gets no path", () => {
  assert.equal(querySelecting(portfolioPhotos, "portfolio_image"), "id, storage_path, caption");
  const gallery = read("src/app/(public-provider)/[username]/(storefront)/photos/page.jsx");
  assert.doesNotMatch(gallery, /storage_path|address|postcode/i);
  assert.match(gallery, /loadVisiblePortfolioPhotos\(/);
});

test("the owner preview has no gallery links; the public page links every hero and preview photo", () => {
  assert.match(storefrontPage, /const galleryUsername = publicView \? provider\.username : null;/);
  // Every gallery entry point takes its username from galleryUsername.
  for (const component of ["HeroCarousel", "BentoHero", "PortfolioPreview"]) {
    assert.match(
      storefrontPage,
      new RegExp(`<${component}[\\s\\S]*?username=\\{galleryUsername\\}`),
      `${component} links only on the public page`,
    );
  }
  for (const file of ["hero-carousel.jsx", "bento-hero.jsx"]) {
    const source = read(`src/features/storefront/${file}`);
    assert.match(source, /username \?/, `${file} renders links only with a username`);
  }
});
