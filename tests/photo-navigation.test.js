import assert from "node:assert/strict";
import test from "node:test";
import {
  MASONRY_GAP_PX,
  MASONRY_ROW_PX,
  TAP_SLOP_PX,
  bentoTiles,
  galleryHref,
  isTap,
  masonryRowSpan,
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

test("the viewer loads only the photo in view and its neighbours", () => {
  const loaded = Array.from({ length: 20 }, (_, index) => index).filter((index) =>
    shouldLoadViewerPhoto(index, 10),
  );
  assert.deepEqual(loaded, [9, 10, 11]);
  assert.deepEqual(
    [0, 1, 2].filter((index) => shouldLoadViewerPhoto(index, 0)),
    [0, 1],
  );
});

test("masonry tiles span whole rows that include the gap", () => {
  assert.equal(masonryRowSpan(0), 1);
  assert.equal(masonryRowSpan(Number.NaN), 1);
  assert.equal(masonryRowSpan(200), Math.ceil((200 + MASONRY_GAP_PX) / MASONRY_ROW_PX));
  // Spans never shrink as tiles get taller, and a taller photo gets more rows.
  for (let height = 1; height < 600; height += 7) {
    assert.ok(masonryRowSpan(height + 7) >= masonryRowSpan(height));
  }
  assert.ok(masonryRowSpan(400) > masonryRowSpan(200));
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
