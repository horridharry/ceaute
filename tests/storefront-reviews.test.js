import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  REVIEWS_PREVIEW_COUNT,
  publicReviewFields,
  reviewerDisplayName,
  reviewsHref,
  reviewsPreview,
} from "../src/features/storefront/reviews.js";
import { publicReviews, visibleReviewsQuery } from "../src/features/storefront/review-queries.js";
import { pluralCount, ratingSummary, shouldShowReviewsSection } from "../src/features/storefront/format.js";

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

const row = (rating, createdAt, fullName = "Ada Lovelace", comment = "Lovely work") => ({
  rating,
  comment,
  created_at: createdAt,
  profile: { full_name: fullName },
});
const rows = (count) =>
  Array.from({ length: count }, (_, index) =>
    row(5, `2026-09-${String(20 - index).padStart(2, "0")}T10:00:00Z`),
  );

test("the storefront preview is the three newest reviews, however many there are", () => {
  assert.equal(REVIEWS_PREVIEW_COUNT, 3);
  for (const count of [0, 1, 2, 3, 4, 10]) {
    const reviews = publicReviews(rows(count));
    assert.equal(reviewsPreview(reviews).length, Math.min(count, 3), `${count} reviews`);
    // The preview takes the front of the list, which the query returns newest first.
    assert.deepEqual(
      reviewsPreview(reviews).map((review) => review.created_at),
      reviews.slice(0, 3).map((review) => review.created_at),
    );
  }
  assert.deepEqual(reviewsPreview(undefined), []);
});

test("zero reviews means no section, and one review reads in the singular", () => {
  assert.equal(shouldShowReviewsSection([]), false);
  assert.equal(shouldShowReviewsSection(publicReviews(rows(1))), true);
  assert.equal(pluralCount(1, "review"), "1 review");
  assert.equal(pluralCount(3, "review"), "3 reviews");
  assert.equal(pluralCount(7, "review"), "7 reviews");
});

test("a review carries only what its card and the rating need, and never a full name", () => {
  const [review] = publicReviews([row(4, "2026-09-20T10:00:00Z", "Ada Lovelace")]);
  assert.deepEqual(Object.keys(review).sort(), ["comment", "created_at", "rating", "reviewer_name"]);
  assert.equal(review.reviewer_name, "Ada");
  assert.equal(reviewerDisplayName({ full_name: "  " }), "Verified customer");
  assert.equal(reviewerDisplayName(undefined), "Verified customer");
  assert.equal(publicReviewFields(row(5, "2026-09-20T10:00:00Z", "Ada", null)).comment, "");
});

test("the average and count come from the same visible reviews on both pages", () => {
  const reviews = publicReviews([
    row(5, "2026-09-20T10:00:00Z"),
    row(4, "2026-09-19T10:00:00Z"),
    row(4, "2026-09-18T10:00:00Z"),
    row(5, "2026-09-17T10:00:00Z"),
  ]);
  const summary = ratingSummary(reviews);
  assert.equal(summary.average, "4.5");
  assert.equal(summary.count, reviews.length);
  assert.equal(summary.countLabel, "4 reviews");
  // The button counts every visible review, not the three shown.
  assert.equal(pluralCount(reviews.length, "review"), "4 reviews");
  assert.equal(reviewsPreview(reviews).length, 3);
  assert.equal(ratingSummary([]), null, "no reviews, no average");
});

test("the All reviews link uses the public username", () => {
  assert.equal(reviewsHref("ada"), "/@ada/reviews");
});

// A stand-in for the Supabase query builder that records each call.
function recordingClient() {
  const calls = {};
  const builder = (table) => {
    const log = (calls[table] = []);
    const chain = new Proxy({}, {
      get: (_, method) => (...args) => {
        log.push([method, ...args]);
        return chain;
      },
    });
    return chain;
  };
  return { calls, client: { schema: () => ({ from: builder }) } };
}

test("the public review query: visible rows of this page, newest first, ties broken by id", () => {
  const { calls, client } = recordingClient();
  visibleReviewsQuery(client, "page-1");
  const log = calls.booking_review;
  const call = (method) => log.filter(([name]) => name === method).map(([, ...args]) => args);

  assert.deepEqual(call("eq"), [["provider_page_id", "page-1"], ["is_visible", true]]);
  assert.deepEqual(
    call("order").map(([column, options]) => `${column} ${options.ascending ? "asc" : "desc"}`),
    ["created_at desc", "id asc"],
  );
  const [[selected]] = call("select");
  assert.equal(selected, "rating, comment, created_at, profile:customer_profile_id(full_name)");
  for (const field of ["email", "phone", "booking_id", "customer_profile_id,", "hidden_at", "id,"]) {
    assert.ok(!selected.includes(field), `the browser never receives ${field}`);
  }
});

test("reviews are read once, through the shared loader, with no second query", () => {
  const viewModel = read("src/features/storefront/storefront-view-model.js");
  const page = read("src/app/(public-provider)/[username]/(storefront)/reviews/page.jsx");
  assert.match(viewModel, /visibleReviewsQuery\(supabase, providerPage\.id\)/);
  assert.doesNotMatch(viewModel, /\.from\("booking_review"\)/, "no second, divergent review query");
  assert.match(page, /loadVisibleReviews\(/);
  assert.doesNotMatch(page, /\.from\(|is_visible|address|postcode/i, "the page reads through the loader only");
  assert.match(page, /ratingSummary\(reviews\)/, "the page's summary comes from the reviews it shows");
});

test("the storefront preview keeps the approved card and adds one counted button", () => {
  const storefront = read("src/features/storefront/storefront-page.jsx");
  const preview = storefront.slice(
    storefront.indexOf("function ReviewsPreview"),
    storefront.indexOf("function Availability"),
  );

  assert.match(preview, /reviewsPreview\(reviews\)\.map/, "at most three cards");
  assert.match(preview, /<ReviewCard key=\{index\} review=\{review\} \/>/);
  assert.ok(
    preview.indexOf("ReviewCard") < preview.indexOf("reviewsHref(username)"),
    "the button sits below the preview",
  );
  assert.match(preview, /className=\{`mt-2 \$\{SECONDARY_BUTTON\}`\}[\s\S]*?See all \$\{pluralCount\(reviews\.length, "review"\)\}/);
  assert.match(preview, /\{username \? \(\s*<Link href=\{reviewsHref\(username\)\}/, "the owner preview has no button");
  assert.equal((preview.match(/<Link/g) ?? []).length, 1, "no duplicate navigation control");
  assert.match(storefront, /shouldShowReviewsSection\(viewModel\.reviews\)/, "no reviews, no section");
});

test("the review card itself is unchanged and shared by both pages", () => {
  const card = read("src/features/storefront/review-card.jsx");
  assert.match(card, /rounded-xl border border-black\/10 p-4 text-sm/, "bordered card kept");
  assert.match(card, /\{review\.rating\}\/5/);
  assert.match(card, /Verified booking/);
  assert.match(card, /whitespace-pre-wrap">\{review\.comment\}/, "no new truncation rule");
  assert.match(card, /\{review\.reviewer_name\} ·/);
  assert.match(card, /day: "2-digit",\s*month: "short",\s*year: "numeric",/);
  assert.doesNotMatch(card, /line-clamp|★|star/i, "no redesign");

  for (const file of [
    "src/features/storefront/storefront-page.jsx",
    "src/app/(public-provider)/[username]/(storefront)/reviews/page.jsx",
  ]) {
    assert.match(read(file), /ReviewCard/, `${file} uses the shared card`);
  }
});

test("All reviews lists every visible review with no filters, sorting or pagination", () => {
  const page = read("src/app/(public-provider)/[username]/(storefront)/reviews/page.jsx");
  assert.match(page, /All reviews/);
  assert.match(page, /reviews\.map\(\(review, index\) => <ReviewCard/, "every review, one list");
  assert.doesNotMatch(page, /slice\(/, "the page never trims the list");
  assert.doesNotMatch(page, /page=|offset|limit|filter|sort|aria-pressed/i, "no filters, sorting or pagination");
  assert.match(page, /href=\{`\/@\$\{providerPage\.username\}`\}/, "back link to the storefront");
});

test("review rules stay pure, and the loader stays off the client", () => {
  const rules = read("src/features/storefront/reviews.js");
  assert.doesNotMatch(rules, /^import /m, "reviews.js imports nothing");
  for (const file of ["src/features/storefront/review-card.jsx", "src/features/storefront/reviews.js"]) {
    const source = read(file).replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(source, /"use client"/, `${file} stays a server component`);
    assert.doesNotMatch(source, /from "[^"]*(supabase|queries)[^"]*"/, `${file} imports no data access`);
  }
});
