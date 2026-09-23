import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TAP_SLOP_PX,
  bentoTiles,
  galleryBentoTiles,
  galleryHref,
  isTap,
  photoIndexById,
  shouldLoadViewerPhoto,
  stepPhotoIndex,
  viewerKeyAction,
} from "../src/features/photo-viewing/photo-navigation.js";

const photos = ["a", "b", "c"].map((id) => ({ id, image_url: `https://x/${id}`, caption: "" }));

test("a photo id selects its index; unknown, empty or missing ids select nothing", () => {
  assert.equal(photoIndexById(photos, "a"), 0);
  assert.equal(photoIndexById(photos, "c"), 2);
  assert.equal(photoIndexById(photos, "zzz"), null);
  assert.equal(photoIndexById(photos, ""), null);
  assert.equal(photoIndexById(photos, null), null);
  assert.equal(photoIndexById([], "a"), null);
  assert.equal(photoIndexById(undefined, "a"), null);
});

test("previous and next stop at the ends", () => {
  assert.equal(stepPhotoIndex(0, -1, 3), 0);
  assert.equal(stepPhotoIndex(0, 1, 3), 1);
  assert.equal(stepPhotoIndex(2, 1, 3), 2);
  assert.equal(stepPhotoIndex(1, -1, 3), 0);
  assert.equal(stepPhotoIndex(0, 1, 1), 0, "a single photo has nowhere to go");
  assert.equal(stepPhotoIndex(0, 1, 0), null);
});

test("viewer keys: arrows move, Home/End jump, Escape closes, others do nothing", () => {
  assert.equal(viewerKeyAction("ArrowLeft"), "previous");
  assert.equal(viewerKeyAction("ArrowRight"), "next");
  assert.equal(viewerKeyAction("Home"), "first");
  assert.equal(viewerKeyAction("End"), "last");
  assert.equal(viewerKeyAction("Escape"), "close");
  assert.equal(viewerKeyAction("Enter"), null);
  assert.equal(viewerKeyAction("Tab"), null);
});

test("a still pointer is a tap; movement or scrolling is a swipe", () => {
  assert.equal(isTap({ startX: 100, startY: 200, endX: 104, endY: 198 }), true);
  assert.equal(isTap({ startX: 100, startY: 200, endX: 100 + TAP_SLOP_PX + 1, endY: 200 }), false);
  assert.equal(isTap({ startX: 100, startY: 200, endX: 100, endY: 200 - TAP_SLOP_PX - 1 }), false);
  assert.equal(
    isTap({ startX: 100, startY: 200, endX: 100, endY: 200, scrollDelta: 375 }),
    false,
    "the finger came back but the track moved an image",
  );
  assert.equal(isTap({ startX: undefined, startY: 200, endX: 100, endY: 200 }), false);
});

test("the viewer loads the photo in view and two either side, and no more", () => {
  const loaded = Array.from({ length: 20 }, (_, index) => index).filter((index) =>
    shouldLoadViewerPhoto(index, 10),
  );
  assert.deepEqual(loaded, [8, 9, 10, 11, 12]);
  assert.deepEqual(
    [0, 1, 2, 3].filter((index) => shouldLoadViewerPhoto(index, 0)),
    [0, 1, 2],
  );
});

// Measured 23 September 2026: moving through the gallery with the router
// re-rendered the page on the server and re-signed every photo URL per swipe.
test("the gallery changes ?photo= through browser history, never the router", () => {
  const gallery = readFileSync("src/features/storefront/photo-gallery.jsx", "utf8");
  assert.match(gallery, /window\.history\.pushState\(null, "", href\)/, "opening a photo adds one entry");
  assert.match(gallery, /window\.history\.replaceState\(null, "", href\)/, "moving between photos replaces it");
  assert.doesNotMatch(gallery, /router\.(push|replace)\(/);
});

// Row-major CSS grid auto-placement without "dense", for the classes
// galleryBentoTiles uses: returns each tile's cells, or throws on overflow.
function autoPlace(placements, columns) {
  const taken = new Set();
  const key = (row, col) => `${row},${col}`;
  let row = 0;
  let col = 0;
  return placements.map((placement) => {
    const span = (axis) => Number(placement.match(new RegExp(`(?:^| )${axis}-span-(\\d)`))[1]);
    const cols = span("col");
    const rows = span("row");
    const start = placement.match(/(?:^| )col-start-(\d)/);
    if (cols > columns) throw new Error(`${placement} is wider than ${columns} columns`);
    const fits = (r, c) => {
      if (c + cols > columns) return false;
      for (let dr = 0; dr < rows; dr += 1) {
        for (let dc = 0; dc < cols; dc += 1) if (taken.has(key(r + dr, c + dc))) return false;
      }
      return true;
    };
    if (start) {
      const fixed = Number(start[1]) - 1;
      if (fixed < col) row += 1;
      while (!fits(row, fixed)) row += 1;
      col = fixed;
    } else {
      while (!fits(row, col)) {
        col += 1;
        if (col + cols > columns) {
          col = 0;
          row += 1;
        }
      }
    }
    const cells = [];
    for (let dr = 0; dr < rows; dr += 1) {
      for (let dc = 0; dc < cols; dc += 1) {
        taken.add(key(row + dr, col + dc));
        cells.push([row + dr, col + dc]);
      }
    }
    const placed = { row, col, cells };
    col += cols;
    return placed;
  });
}

const phoneClasses = (placement) =>
  placement.split(" ").filter((name) => !name.startsWith("md:")).join(" ");
const wideClasses = (placement) =>
  placement.split(" ").filter((name) => name.startsWith("md:")).map((name) => name.slice(3)).join(" ");

test("the gallery grid fills every row, in portfolio order, at every size", () => {
  assert.deepEqual(galleryBentoTiles(0), []);
  assert.deepEqual(galleryBentoTiles(undefined), []);

  for (let count = 1; count <= 40; count += 1) {
    const tiles = galleryBentoTiles(count);
    assert.equal(tiles.length, count, `${count} photos, ${count} tiles`);
    assert.deepEqual(tiles.map((tile) => tile.index), tiles.map((_, index) => index));

    for (const [columns, classes] of [[2, phoneClasses], [4, wideClasses]]) {
      const placed = autoPlace(tiles.map((tile) => classes(tile.placement)), columns);
      // Reading order (top then left) is portfolio order.
      for (let index = 1; index < placed.length; index += 1) {
        const [before, after] = [placed[index - 1], placed[index]];
        assert.ok(
          after.row > before.row || (after.row === before.row && after.col > before.col),
          `${count} photos on ${columns} columns: photo ${index + 1} reads after photo ${index}`,
        );
      }
      // No holes, except either side of a centred photo from md up.
      const rows = Math.max(...placed.flatMap((tile) => tile.cells.map(([row]) => row))) + 1;
      const filled = placed.reduce((sum, tile) => sum + tile.cells.length, 0);
      const centred = tiles.filter((tile) => tile.placement.includes("col-start")).length;
      const allowedHoles = columns === 4 ? centred * 4 : 0;
      assert.equal(rows * columns - filled, allowedHoles, `${count} photos on ${columns} columns`);
    }
  }
});

test("the gallery grid mixes large and small photos and centres a lone one", () => {
  const large = (tile) => tile.placement.includes("md:col-span-2");
  assert.deepEqual(galleryBentoTiles(1).map((tile) => tile.placement), [
    "col-span-2 row-span-2 md:col-span-2 md:row-span-2 md:col-start-2",
  ]);
  assert.deepEqual(galleryBentoTiles(2).map(large), [true, true]);
  assert.deepEqual(galleryBentoTiles(3).map(large), [true, true, true]);
  assert.deepEqual(galleryBentoTiles(5).map(large), [true, false, false, false, false]);
  // Blocks of five alternate the large photo's side.
  assert.deepEqual(galleryBentoTiles(10).map(large), [
    true, false, false, false, false,
    false, false, true, false, false,
  ]);
  // Phones: one large, two small.
  assert.deepEqual(
    galleryBentoTiles(6).map((tile) => phoneClasses(tile.placement)),
    ["col-span-2 row-span-2", "col-span-1 row-span-1", "col-span-1 row-span-1",
      "col-span-2 row-span-2", "col-span-1 row-span-1", "col-span-1 row-span-1"],
  );
  for (const tile of galleryBentoTiles(20)) {
    assert.match(tile.placement, /^col-span-(1 row-span-1|2 row-span-2) md:col-span-(1 md:row-span-1|2 md:row-span-2)$/,
      "every tile is one 4:5 cell or a 2 x 2 block of the same shape");
  }
});

test("the Bento grid has one prominent photo and at most four supporting ones", () => {
  assert.deepEqual(bentoTiles(0), []);
  assert.deepEqual(bentoTiles(1).map((tile) => tile.placement), ["col-span-4 row-span-2"]);
  assert.deepEqual(bentoTiles(2).map((tile) => tile.placement), [
    "col-span-2 row-span-2",
    "col-span-2 row-span-2",
  ]);
  assert.equal(bentoTiles(3).length, 3);
  assert.equal(bentoTiles(4).length, 4);
  assert.equal(bentoTiles(5).length, 5);
  assert.equal(bentoTiles(20).length, 5, "never more than five tiles");

  for (let count = 1; count <= 6; count += 1) {
    const tiles = bentoTiles(count);
    assert.equal(tiles[0].placement, count === 1 ? "col-span-4 row-span-2" : "col-span-2 row-span-2");
    assert.deepEqual(tiles.map((tile) => tile.index), tiles.map((_, index) => index), "portfolio order");
    // Every layout fills the 4 x 2 grid exactly.
    const cells = tiles.reduce((sum, { placement }) => {
      const [, cols] = placement.match(/col-span-(\d)/);
      const [, rows] = placement.match(/row-span-(\d)/);
      return sum + Number(cols) * Number(rows);
    }, 0);
    assert.equal(cells, 8, `${count} photos fill the grid`);
  }
});

test("gallery links use the public username and the photo id only", () => {
  assert.equal(galleryHref("ada"), "/@ada/photos");
  assert.equal(galleryHref("ada", "0b8d-1"), "/@ada/photos?photo=0b8d-1");
  assert.equal(galleryHref("ada", "a b"), "/@ada/photos?photo=a%20b");
});
