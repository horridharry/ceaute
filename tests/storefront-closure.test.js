import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import nextConfig from "../next.config.ts";

// Stage 0 closes the storefront and the empty home page, pinned on the source
// because the pages cannot be rendered here:
// - the storefront has no Booking terms section (decision 9): its order is
//   Hero, Identity, Portfolio, Treatments, Reviews, Availability;
// - booking terms and cancellation information stay at booking review, and
//   providers still configure them;
// - `/` redirects to Discover before rendering, so there is no empty page.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) =>
  readFileSync(path.join(REPO_ROOT, relativePath), "utf8").replace(/\/\/.*$/gm, "");

const storefront = read("src/features/storefront/storefront-page.jsx");
const viewModel = read("src/features/storefront/storefront-view-model.js");
const CHECKOUT = "src/app/(public-provider)/[username]/book/[treatmentId]/checkout";

test("the storefront renders no Booking terms section and reads no booking settings", () => {
  assert.doesNotMatch(storefront, /Booking terms|PaymentTerms|booking_terms/);
  assert.doesNotMatch(storefront, /written_policy|cancellation_window_hours|commitment_amount_pence/);
  assert.doesNotMatch(viewModel, /provider_booking_setting|booking_terms|mapBookingTerms/);
});

test("the storefront sections keep the approved order, with Availability last", () => {
  const body = storefront.slice(storefront.indexOf("export function StorefrontPage"));
  const order = [
    "<HeroCarousel",
    "<BentoHero",
    "<ProviderIdentity",
    "<PortfolioPreview",
    "<TreatmentsPreview",
    "<ReviewsPreview",
    "<Availability",
  ].map((marker) => {
    const index = body.indexOf(marker);
    assert.ok(index >= 0, `${marker} is rendered`);
    return index;
  });
  assert.deepEqual(order, [...order].sort((a, b) => a - b));

  const afterAvailability = body.slice(body.indexOf("<Availability") + 1);
  assert.doesNotMatch(
    afterAvailability.slice(0, afterAvailability.indexOf("</main>")),
    /<[A-Z]\w+[\s/>]/,
    "no component follows Availability",
  );
});

test("the owner preview keeps its restrictions", () => {
  assert.match(storefront, /const publicView = !backHref;/);
  assert.match(storefront, /const galleryUsername = publicView \? provider\.username : null;/);
  assert.match(storefront, /const bookingUsername = publicView \? provider\.username : null;/);
  assert.match(storefront, /<TreatmentsPreview[\s\S]*?username=\{bookingUsername\}/);
  assert.match(storefront, /<ReviewsPreview reviews=\{viewModel\.reviews\} username=\{bookingUsername\} \/>/);
});

test("booking review still states the cancellation window, outcome and written policy", () => {
  // Review and pay and the held page share one Cancellation block
  // (checkout/_components/booking-summary.jsx), fed from the SQL quote before
  // a hold and from the booking snapshot after it.
  const summary = read(`${CHECKOUT}/_components/booking-summary.jsx`);
  assert.match(summary, /Free cancellation until <strong>\{cancellation\.deadline\}<\/strong>, \{cancellation\.windowHours\} hours/);
  assert.match(summary, /After that, \{cancellation\.summary\}/);
  assert.match(summary, /\{cancellation\.policy\}/);

  const page = read(`${CHECKOUT}/page.jsx`);
  assert.match(page, /cancellationView\(quote, \{ startAt, providerName, policy: terms\?\.written_policy \}\)/, "Review uses the SQL quote");
  assert.match(page, /cancellationView\(terms, \{\s*startAt: summary\.start_at,[\s\S]*?policy: snapshot\.written_policy,/, "the held page uses the snapshot");
  assert.match(page, /getPublicBookingDetailsPage\(/, "checkout loads its own booking terms");
});

test("providers still configure their booking terms", () => {
  assert.match(read("src/app/(dashboard)/dashboard/settings/booking/queries.js"), /\.from\("provider_booking_setting"\)/);
  assert.match(read("src/app/(dashboard)/dashboard/settings/booking/actions.js"), /\.from\("provider_booking_setting"\)/);
  assert.ok(existsSync(path.join(REPO_ROOT, "src/app/(dashboard)/dashboard/settings/booking/page.jsx")));
});

test("the home page redirects to Discover before rendering", async () => {
  const redirects = await nextConfig.redirects();
  const home = redirects.filter((redirect) => redirect.source === "/");
  assert.deepEqual(home, [{ source: "/", destination: "/discover", permanent: false }]);
  assert.equal(
    existsSync(path.join(REPO_ROOT, "src/app/(site)/page.tsx")),
    false,
    "no empty home page is left to render",
  );
  assert.ok(existsSync(path.join(REPO_ROOT, "src/app/(site)/discover/page.jsx")));
});

test("the header logo leads to Discover outside the provider workspace", () => {
  const header = read("src/components/app-header/app-header-client.jsx");
  assert.match(header, /<HomeLogo\s+href=\{isProviderWorkspace \? "\/dashboard" : "\/discover"\}/);
});
