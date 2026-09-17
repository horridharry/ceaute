import assert from "node:assert/strict";
import test from "node:test";
import {
  formatDateLabel,
  formatTimeLabel,
  shouldShowReviewsSection,
} from "../src/app/(public-provider)/[username]/_lib/public-provider-format.js";

test("formats winter appointments in Europe/London GMT", () => {
  const startAt = new Date("2026-01-15T10:00:00.000Z");

  assert.equal(formatTimeLabel(startAt), "10:00 am");
  assert.match(formatDateLabel(startAt), /15 Jan/);
});

test("formats September appointments in Europe/London BST", () => {
  const startAt = new Date("2026-09-15T09:00:00.000Z");
  const endAt = new Date("2026-09-15T10:00:00.000Z");

  assert.equal(formatTimeLabel(startAt), "10:00 am");
  assert.match(formatDateLabel(startAt), /15 Sept/);
  assert.equal(formatTimeLabel(endAt), "11:00 am");
});

// en-GB with `hour12: true` renders noon as "0:00 pm" under ICU, so the
// formatters pin the twelve-hour cycle explicitly.
test("formats noon and half past midnight as 12-hour times", () => {
  assert.equal(formatTimeLabel(new Date("2026-10-20T11:00:00.000Z")), "12:00 pm");
  assert.equal(formatTimeLabel(new Date("2026-10-20T23:30:00.000Z")), "12:30 am");
});

test("a provider with zero visible reviews shows no reviews section", () => {
  assert.equal(shouldShowReviewsSection([]), false);
  assert.equal(shouldShowReviewsSection(undefined), false);
  assert.equal(shouldShowReviewsSection(null), false);
});

test("a provider with one or more visible reviews shows the reviews section", () => {
  assert.equal(
    shouldShowReviewsSection([{ rating: 5, comment: "", created_at: "2026-01-01" }]),
    true,
  );
  assert.equal(
    shouldShowReviewsSection([
      { rating: 5, comment: "", created_at: "2026-01-01" },
      { rating: 4, comment: "", created_at: "2026-01-02" },
    ]),
    true,
  );
});
