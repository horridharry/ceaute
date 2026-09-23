import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The storefront returns a real 404 for a missing or unpublished provider by
// checking the published page in a layout that sits outside its loading.jsx
// boundary. That check must stay scoped to the storefront: checkout for an
// existing hold or booking, including Stripe's success and cancel returns,
// has to keep working after the provider is unpublished or suspended. These
// tests pin that route structure, because the pages cannot be rendered here.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const USERNAME_DIR = path.join(REPO_ROOT, "src/app/(public-provider)/[username]");
const STOREFRONT_DIR = path.join(USERNAME_DIR, "(storefront)");
const BOOK_DIR = path.join(USERNAME_DIR, "book");
const CHECKOUT_PAGE = path.join(BOOK_DIR, "[treatmentId]/checkout/page.jsx");
const PUBLISHED_LOOKUPS = [
  "getPublishedProviderPageByUsername",
  "getPublicBookingDetailsPage",
  "getPublicBookingPage",
];

function read(file) {
  return readFileSync(file, "utf8");
}

function withoutComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function routeFile(dir, name) {
  return ["jsx", "js", "tsx", "ts"]
    .map((extension) => path.join(dir, `${name}.${extension}`))
    .find((file) => existsSync(file));
}

// Every layout and loading file that wraps a route directory, from the app
// root down to that directory.
function wrappingFiles(routeDir, name) {
  const appDir = path.join(REPO_ROOT, "src/app");
  const files = [];
  let dir = routeDir;

  while (dir.startsWith(appDir)) {
    const file = routeFile(dir, name);
    if (file) files.push(file);
    if (dir === appDir) break;
    dir = path.dirname(dir);
  }

  return files;
}

function bookRouteDirs(dir = BOOK_DIR) {
  const dirs = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const child = path.join(dir, entry.name);
    if (routeFile(child, "page")) dirs.push(child);
    dirs.push(...bookRouteDirs(child));
  }
  return dirs;
}

test("the storefront page lives in its own route group with the published check", () => {
  const layout = routeFile(STOREFRONT_DIR, "layout");

  assert.ok(routeFile(STOREFRONT_DIR, "page"), "storefront page is in (storefront)");
  assert.ok(layout, "(storefront) has a layout");
  assert.match(
    withoutComments(read(layout)),
    /await\s+getPublishedProviderPageByUsername\(/,
  );
});

test("no loading boundary wraps the storefront's published check", () => {
  // A loading.jsx at [username] or above would stream a fallback before the
  // (storefront) layout runs, and the 404 would become a 200.
  const loadingAbove = wrappingFiles(USERNAME_DIR, "loading");

  assert.deepEqual(
    loadingAbove.map((file) => path.relative(REPO_ROOT, file)),
    [],
  );
  assert.ok(
    routeFile(STOREFRONT_DIR, "loading"),
    "the storefront keeps its loading state inside the group",
  );
});

test("no layout above a booking route checks that the provider is published", () => {
  const routes = bookRouteDirs();
  assert.ok(
    routes.some((dir) => dir.endsWith(path.join("checkout"))),
    "the checkout route was found",
  );

  for (const routeDir of routes) {
    for (const layout of wrappingFiles(routeDir, "layout")) {
      const source = withoutComments(read(layout));
      for (const lookup of PUBLISHED_LOOKUPS) {
        assert.ok(
          !source.includes(lookup),
          `${path.relative(REPO_ROOT, layout)} wraps ${path.relative(REPO_ROOT, routeDir)} and calls ${lookup}`,
        );
      }
    }
  }
});

test("checkout serves an existing hold or booking before any published-provider lookup", () => {
  const source = withoutComments(read(CHECKOUT_PAGE));
  const holdBranch = source.indexOf("if (holdId)");

  assert.ok(holdBranch > 0, "checkout has an existing hold/booking branch");
  assert.match(
    source,
    /searchValue\(query, "hold"\)\s*\|\|\s*searchValue\(query, "booking"\)/,
    "the branch covers both ?hold= and ?booking=",
  );

  for (const lookup of PUBLISHED_LOOKUPS) {
    const call = source.indexOf(`${lookup}(`);
    assert.ok(
      call === -1 || call > holdBranch,
      `${lookup} runs before the hold/booking branch`,
    );
  }

  // The hold branch returns the held page, which never reaches the
  // published-provider lookup: a booking outlives its provider's page.
  const branchBody = source.slice(holdBranch, source.indexOf("return renderHeldBooking(", holdBranch));
  const heldPage = source.slice(source.indexOf("async function renderHeldBooking("));
  assert.ok(heldPage.length > 0, "the held page is rendered by renderHeldBooking");
  for (const lookup of PUBLISHED_LOOKUPS) {
    assert.ok(!branchBody.includes(lookup), `hold branch calls ${lookup}`);
    assert.ok(!heldPage.includes(lookup), `the held page calls ${lookup}`);
  }
});

test("Stripe returns to the checkout hold path", () => {
  const session = withoutComments(read(path.join(REPO_ROOT, "src/lib/bookings/checkout-session.js")));
  const paths = withoutComments(read(path.join(REPO_ROOT, "src/lib/bookings/held-booking-path.js")));

  assert.match(session, /successUrl\s*=\s*`\$\{origin\}\$\{withState\(returnPath, "checkout", "success"\)\}/);
  assert.match(session, /cancelUrl\s*=\s*`\$\{origin\}\$\{withState\(returnPath, "checkout", "cancelled"\)\}/);
  // The return path is built from the booking itself, never from the browser.
  assert.match(session, /returnPath: heldPathForBooking\(booking\)/);
  assert.match(paths, /searchParams\.set\("hold",\s*holdId\)/);
  assert.match(paths, /\/checkout\?\$\{searchParams\.toString\(\)\}/);
});

test("the gallery lives in the storefront group, under its published check", () => {
  const galleryDir = path.join(STOREFRONT_DIR, "photos");
  const page = routeFile(galleryDir, "page");

  assert.ok(page, "(storefront)/photos/page exists");
  assert.ok(
    wrappingFiles(galleryDir, "layout").includes(routeFile(STOREFRONT_DIR, "layout")),
    "the (storefront) layout wraps the gallery",
  );
  assert.deepEqual(
    wrappingFiles(galleryDir, "loading")
      .map((file) => path.relative(REPO_ROOT, file))
      .filter((file) => !file.includes("(storefront)")),
    [],
    "no loading boundary above the published check",
  );
  assert.match(withoutComments(read(page)), /loadVisiblePortfolioPhotos\(/);
});

test("All treatments lives in the storefront group, under its published check", () => {
  const treatmentsDir = path.join(STOREFRONT_DIR, "treatments");
  const page = routeFile(treatmentsDir, "page");

  assert.ok(page, "(storefront)/treatments/page exists");
  assert.ok(
    wrappingFiles(treatmentsDir, "layout").includes(routeFile(STOREFRONT_DIR, "layout")),
    "the (storefront) layout wraps All treatments",
  );
  assert.deepEqual(
    wrappingFiles(treatmentsDir, "loading")
      .map((file) => path.relative(REPO_ROOT, file))
      .filter((file) => !file.includes("(storefront)")),
    [],
    "no loading boundary above the published check",
  );
  assert.match(withoutComments(read(page)), /getPublishedProviderPageByUsername\(/);
});

test("All reviews lives in the storefront group, under its published check", () => {
  const reviewsDir = path.join(STOREFRONT_DIR, "reviews");
  const page = routeFile(reviewsDir, "page");

  assert.ok(page, "(storefront)/reviews/page exists");
  assert.ok(
    wrappingFiles(reviewsDir, "layout").includes(routeFile(STOREFRONT_DIR, "layout")),
    "the (storefront) layout wraps All reviews",
  );
  assert.deepEqual(
    wrappingFiles(reviewsDir, "loading")
      .map((file) => path.relative(REPO_ROOT, file))
      .filter((file) => !file.includes("(storefront)")),
    [],
    "no loading boundary above the published check",
  );
  assert.match(withoutComments(read(page)), /getPublishedProviderPageByUsername\(/);
});
