import assert from "node:assert/strict";
import test from "node:test";
import { storefrontMetadata } from "../src/features/storefront/format.js";

test("titles the page with the provider's name", () => {
  assert.equal(
    storefrontMetadata({ display_name: "Nails by Ada", username: "ada" }).title,
    "Nails by Ada | Ceaute",
  );
});

test("falls back to the username when there is no display name", () => {
  assert.equal(
    storefrontMetadata({ display_name: "  ", username: "ada" }).title,
    "@ada | Ceaute",
  );
});

test("uses a short bio as the description, with whitespace collapsed", () => {
  assert.equal(
    storefrontMetadata({
      display_name: "Ada",
      username: "ada",
      biography: "Gel nails\n\nand  lashes in Leeds.",
    }).description,
    "Gel nails and lashes in Leeds.",
  );
});

test("shortens a long bio at a word boundary within 160 characters", () => {
  const biography = `${"word ".repeat(60)}end`;
  const { description } = storefrontMetadata({
    display_name: "Ada",
    username: "ada",
    biography,
  });

  assert.ok(description.length <= 160, `${description.length} characters`);
  assert.ok(description.endsWith("word…"));
});

test("describes a provider without a bio plainly", () => {
  assert.equal(
    storefrontMetadata({ display_name: "Ada", username: "ada", biography: "" })
      .description,
    "Book with Ada on Ceaute.",
  );
});
