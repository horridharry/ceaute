import assert from "node:assert/strict";
import test from "node:test";
import { portfolioImagesWithSignedUrls } from "../src/features/storefront/storefront-view-model.js";

const rows = [
  { storage_path: "a.jpg", caption: "First" },
  { storage_path: "b.jpg", caption: null },
  { storage_path: "c.jpg", caption: "Third" },
];

test("pairs every signed image with its URL in the original order", () => {
  const urls = new Map([
    ["a.jpg", "https://signed/a"],
    ["b.jpg", "https://signed/b"],
    ["c.jpg", "https://signed/c"],
  ]);

  assert.deepEqual(portfolioImagesWithSignedUrls(rows, urls), [
    { image_url: "https://signed/a", caption: "First" },
    { image_url: "https://signed/b", caption: "" },
    { image_url: "https://signed/c", caption: "Third" },
  ]);
});

test("leaves out images whose path could not be signed", () => {
  const urls = new Map([
    ["a.jpg", "https://signed/a"],
    ["c.jpg", "https://signed/c"],
  ]);

  assert.deepEqual(
    portfolioImagesWithSignedUrls(rows, urls).map((image) => image.image_url),
    ["https://signed/a", "https://signed/c"],
  );
});

test("returns no images when signing failed entirely", () => {
  assert.deepEqual(portfolioImagesWithSignedUrls(rows, new Map()), []);
});
