import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DISCOVER_HERO_ASPECT, DiscoverPhotoHero } from "../src/app/(site)/discover/_components/discover-photo-hero.jsx";

// Approved 23 September 2026: a swipeable photo hero on Discover cards, with
// controls that work on their own (never a button inside a link), and no
// swipe that opens the storefront.
const photos = ["https://example.test/a.jpg", "https://example.test/b.jpg", "https://example.test/c.jpg"];
const hero = (list) => renderToStaticMarkup(h(DiscoverPhotoHero, { photos: list, href: "/@studio.nala", name: "Studio Nala" }));

// Every <a>…</a> span of the markup, so nothing can hide inside one.
function anchors(html) {
  return [...html.matchAll(/<a\b[\s\S]*?<\/a>/g)].map(([match]) => match);
}

test("no button is ever inside a link, and the photo links are pointer-only", () => {
  const html = hero(photos);
  for (const anchor of anchors(html)) {
    assert.doesNotMatch(anchor, /<button/);
    assert.match(anchor, /tabindex="-1"/);
    assert.match(anchor, /href="\/@studio\.nala"/);
  }
  assert.equal(anchors(html).length, 3, "one link per photo, no duplicates");
  assert.match(html, /<button[^>]*aria-label="Previous photo of Studio Nala"/);
  assert.match(html, /<button[^>]*aria-label="Next photo of Studio Nala"/);
});

test("the first photo cannot go back and the last cannot go forward", () => {
  const html = hero(photos);
  assert.match(html, /aria-label="Previous photo of Studio Nala" aria-disabled="true"/);
  assert.match(html, /aria-label="Next photo of Studio Nala" aria-disabled="false"/);
});

test("one photo gets no arrows, dots or swipe, and no photo is repeated", () => {
  const single = hero([photos[0]]);
  assert.doesNotMatch(single, /<button/);
  assert.doesNotMatch(single, /snap-x/);
  assert.equal((single.match(/<img/g) ?? []).length, 1);
  assert.equal((hero(photos).match(/<img/g) ?? []).length, 3);
});

test("the hero is 4:5 for this pass, set in one place", () => {
  assert.equal(DISCOVER_HERO_ASPECT, "aspect-[4/5]");
  assert.match(hero(photos), /aspect-\[4\/5\]/);
});

test("a swipe never follows a photo link; only a tap without movement does", () => {
  const source = readFileSync("src/app/(site)/discover/_components/discover-photo-hero.jsx", "utf8");
  assert.match(source, /const tap = isTap\(/);
  assert.match(source, /if \(!tap\) event\.preventDefault\(\);/);
});

test("the card: name is the link and comes first; no reviews reads a plain New", () => {
  const page = readFileSync("src/app/(site)/discover/page.jsx", "utf8");
  const card = page.slice(page.indexOf("function ProviderCard"), page.indexOf("function resultLabel"));
  assert.match(card, /<article className="flex flex-col gap-2">/);
  assert.ok(card.indexOf("<Link") < card.indexOf("<DiscoverPhotoHero"), "the name link comes before the photos");
  assert.match(card, /<div className="order-first">/);
  assert.doesNotMatch(page, /rounded-full border border-line px-2\.5 py-0\.5 text-xs font-semibold text-ink-muted">\s*New/);
  assert.match(page, /<span className="text-sm font-medium text-ink-muted">New<\/span>/);
});
