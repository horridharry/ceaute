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

import { storefrontPageMetadata } from "../src/features/storefront/format.js";

const providerPage = {
  display_name: "Nails by Ada",
  username: "ada",
  biography: "Gel nails in Leeds.",
};

test("link previews use the hero image at a stable, versioned URL", () => {
  const metadata = storefrontPageMetadata({
    providerPage,
    origin: "https://ceaute.com/",
    heroImageId: "img-1",
  });

  assert.equal(metadata.title, "Nails by Ada | Ceaute");
  assert.equal(metadata.openGraph.url, "https://ceaute.com/@ada");
  assert.deepEqual(metadata.openGraph.images, [
    { url: "https://ceaute.com/@ada/og-image?v=img-1", alt: "Work by Nails by Ada" },
  ]);
  assert.equal(metadata.openGraph.title, "Nails by Ada | Ceaute");
  assert.equal(metadata.openGraph.description, "Gel nails in Leeds.");
  assert.equal(metadata.twitter.card, "summary_large_image");
  assert.deepEqual(metadata.twitter.images, ["https://ceaute.com/@ada/og-image?v=img-1"]);
});

test("without a hero image there is no preview image, not a broken one", () => {
  const metadata = storefrontPageMetadata({
    providerPage,
    origin: "https://ceaute.com",
    heroImageId: null,
  });

  assert.equal(metadata.openGraph.images, undefined);
  assert.equal(metadata.twitter.images, undefined);
  assert.equal(metadata.twitter.card, "summary");
  assert.equal(metadata.openGraph.url, "https://ceaute.com/@ada");
});

test("without a known site origin no absolute URLs are invented", () => {
  const metadata = storefrontPageMetadata({
    providerPage,
    origin: null,
    heroImageId: "img-1",
  });

  assert.equal(metadata.openGraph.url, undefined);
  assert.equal(metadata.openGraph.images, undefined);
  assert.equal(metadata.description, "Gel nails in Leeds.");
});
