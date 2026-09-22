import assert from "node:assert/strict";
import test from "node:test";
import {
  addMinutes,
  formatDateLabel,
  formatDurationMinutes,
  formatPricePence,
  formatTimeLabel,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
  pluralCount,
  shouldShowReviewsSection,
  treatmentMetaLine,
} from "../src/features/storefront/format.js";

test("hasPublicUsernamePrefix recognises a leading @, including URL-encoded", () => {
  assert.equal(hasPublicUsernamePrefix("@jane"), true);
  assert.equal(hasPublicUsernamePrefix("%40jane"), true);
  assert.equal(hasPublicUsernamePrefix("  @jane  "), true);
  assert.equal(hasPublicUsernamePrefix("jane"), false);
  assert.equal(hasPublicUsernamePrefix(""), false);
  assert.equal(hasPublicUsernamePrefix(undefined), false);
  assert.equal(hasPublicUsernamePrefix(null), false);
});

test("normalizePublicUsername strips the @, decodes, trims and lowercases", () => {
  assert.equal(normalizePublicUsername("@Jane"), "jane");
  assert.equal(normalizePublicUsername("%40Jane"), "jane");
  assert.equal(normalizePublicUsername("  @Jane  "), "jane");
  assert.equal(normalizePublicUsername("Jane"), "jane");
  assert.equal(normalizePublicUsername(""), "");
  assert.equal(normalizePublicUsername(undefined), "");
  assert.equal(normalizePublicUsername(null), "");
});

test("formatPricePence renders whole pounds in GBP", () => {
  assert.equal(formatPricePence(0), "£0.00");
});

test("formatPricePence renders negative pence with a leading minus", () => {
  assert.equal(formatPricePence(-150), "-£1.50");
});

test("formatPricePence rounds non-integer pence to the nearest penny", () => {
  assert.equal(formatPricePence(150.5), "£1.51");
});

test("formatPricePence treats null and undefined as zero", () => {
  assert.equal(formatPricePence(null), "£0.00");
  assert.equal(formatPricePence(undefined), "£0.00");
});

test("formatDurationMinutes renders minutes-only durations under an hour", () => {
  // Current behaviour: zero minutes is still rendered as "0 min" rather than
  // being omitted or treated specially.
  assert.equal(formatDurationMinutes(0), "0 min");
  assert.equal(formatDurationMinutes(59), "59 min");
});

test("formatDurationMinutes renders whole-hour durations without a minutes part", () => {
  assert.equal(formatDurationMinutes(60), "1 hr");
  assert.equal(formatDurationMinutes(120), "2 hr");
});

test("formatDurationMinutes renders hour-and-minutes durations", () => {
  assert.equal(formatDurationMinutes(61), "1 hr 1 min");
  assert.equal(formatDurationMinutes(90), "1 hr 30 min");
});

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

test("addMinutes adds whole minutes to a date", () => {
  const startAt = new Date("2026-01-01T00:00:00.000Z");

  assert.equal(addMinutes(startAt, 90).toISOString(), "2026-01-01T01:30:00.000Z");
});

test("addMinutes treats a missing minutes value as zero", () => {
  const startAt = new Date("2026-01-01T00:00:00.000Z");

  assert.equal(addMinutes(startAt, null).toISOString(), startAt.toISOString());
  assert.equal(addMinutes(startAt, undefined).toISOString(), startAt.toISOString());
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

test("counts read naturally in singular and plural", () => {
  assert.equal(pluralCount(0, "photo"), "0 photos");
  assert.equal(pluralCount(1, "photo"), "1 photo");
  assert.equal(pluralCount(18, "photo"), "18 photos");
  assert.equal(pluralCount(1, "treatment"), "1 treatment");
  assert.equal(pluralCount(3, "review"), "3 reviews");
  assert.equal(pluralCount(-2, "review"), "0 reviews", "a nonsense count never reads negative");
  assert.equal(pluralCount(undefined, "review"), "0 reviews");
});

test("a treatment card's line is duration, price, and add-ons only when it has them", () => {
  const treatment = { duration_minutes: 150, price_pence: 12000, add_ons: [] };
  assert.equal(treatmentMetaLine(treatment), "2 hr 30 min \u00b7 \u00a3120.00");
  assert.equal(
    treatmentMetaLine({ ...treatment, add_ons: [{ id: "o1" }] }),
    "2 hr 30 min \u00b7 \u00a3120.00 \u00b7 Add-ons available",
  );
  assert.doesNotMatch(treatmentMetaLine({ ...treatment, add_ons: undefined }), /Add-ons/);
});
