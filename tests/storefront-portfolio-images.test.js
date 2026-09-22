import assert from "node:assert/strict";
import test from "node:test";
import { portfolioImagesWithSignedUrls } from "../src/features/storefront/portfolio-photos.js";

const rows = [
  { id: "id-a", storage_path: "a.jpg", caption: "First" },
  { id: "id-b", storage_path: "b.jpg", caption: null },
  { id: "id-c", storage_path: "c.jpg", caption: "Third" },
];

test("pairs every signed image with its URL in the original order", () => {
  const urls = new Map([
    ["a.jpg", "https://signed/a"],
    ["b.jpg", "https://signed/b"],
    ["c.jpg", "https://signed/c"],
  ]);

  assert.deepEqual(portfolioImagesWithSignedUrls(rows, urls), [
    { id: "id-a", image_url: "https://signed/a", caption: "First" },
    { id: "id-b", image_url: "https://signed/b", caption: "" },
    { id: "id-c", image_url: "https://signed/c", caption: "Third" },
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

test("photos sent to the browser carry an id, never the storage path", () => {
  const urls = new Map([["a.jpg", "https://signed/a"]]);
  const [photo] = portfolioImagesWithSignedUrls(rows, urls);

  assert.deepEqual(Object.keys(photo).sort(), ["caption", "id", "image_url"]);
  assert.equal(JSON.stringify(photo).includes("storage_path"), false);
});
