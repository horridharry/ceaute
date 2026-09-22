import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  OG_IMAGE_CACHE_CONTROL,
  findPublishedHeroImage,
  ogImageResponse,
} from "../src/features/storefront/hero-image.js";

// A minimal stand-in for the Supabase query builder. Each from(table) query
// records its filters and ordering and answers from `rows[table]` by
// applying the eq filters, ordering and limit like PostgREST would.
function fakeSupabase(rows) {
  const queries = [];

  return {
    queries,
    schema() {
      return this;
    },
    from(table) {
      const query = { table, filters: [], orders: [], limit: null };
      queries.push(query);
      const builder = {
        select() {
          return builder;
        },
        eq(column, value) {
          query.filters.push([column, value]);
          return builder;
        },
        order(column, { ascending }) {
          query.orders.push([column, ascending]);
          return builder;
        },
        limit(count) {
          query.limit = count;
          return builder;
        },
        async maybeSingle() {
          let result = (rows[table] ?? []).filter((row) =>
            query.filters.every(([column, value]) => row[column] === value),
          );
          for (const [column, ascending] of [...query.orders].reverse()) {
            result = [...result].sort((a, b) =>
              (a[column] > b[column] ? 1 : a[column] < b[column] ? -1 : 0) *
              (ascending ? 1 : -1),
            );
          }
          if (query.limit !== null) result = result.slice(0, query.limit);
          return { data: result[0] ?? null, error: null };
        },
      };
      return builder;
    },
  };
}

const PAGE = { id: "page-1", username: "ada", status: "published" };

function image(id, overrides = {}) {
  return {
    id,
    provider_page_id: "page-1",
    storage_path: `page-1/${id}.jpg`,
    is_visible: true,
    display_order: 10,
    created_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

test("the hero image is the first visible image in display order", async () => {
  const supabase = fakeSupabase({
    provider_page: [PAGE],
    portfolio_image: [
      image("late", { display_order: 30 }),
      image("first", { display_order: 10, created_at: "2026-09-02T00:00:00Z" }),
      image("tie-older", { display_order: 10, created_at: "2026-09-01T00:00:00Z" }),
    ],
  });

  const hero = await findPublishedHeroImage(supabase, "ada");

  assert.deepEqual(hero, { id: "tie-older", storagePath: "page-1/tie-older.jpg", username: "ada" });
  const imageQuery = supabase.queries.find((query) => query.table === "portfolio_image");
  assert.deepEqual(imageQuery.orders, [["display_order", true], ["created_at", true]]);
});

test("a hidden image is never the hero, even when it is first in order", async () => {
  const supabase = fakeSupabase({
    provider_page: [PAGE],
    portfolio_image: [
      image("hidden", { display_order: 1, is_visible: false }),
      image("shown", { display_order: 20 }),
    ],
  });

  assert.equal((await findPublishedHeroImage(supabase, "ada")).id, "shown");
});

test("hiding the only visible image leaves no hero image", async () => {
  const rows = { provider_page: [PAGE], portfolio_image: [image("only")] };
  assert.equal((await findPublishedHeroImage(fakeSupabase(rows), "ada")).id, "only");

  rows.portfolio_image[0].is_visible = false;
  assert.equal(await findPublishedHeroImage(fakeSupabase(rows), "ada"), null);
});

test("an unpublished page has no hero image", async () => {
  for (const status of ["draft", "suspended"]) {
    const supabase = fakeSupabase({
      provider_page: [{ ...PAGE, status }],
      portfolio_image: [image("first")],
    });
    assert.equal(await findPublishedHeroImage(supabase, "ada"), null);
    assert.equal(
      supabase.queries.some((query) => query.table === "portfolio_image"),
      false,
      "no portfolio query for an unpublished page",
    );
  }
});

test("an empty username does not query at all", async () => {
  const supabase = fakeSupabase({ provider_page: [PAGE] });
  assert.equal(await findPublishedHeroImage(supabase, ""), null);
  assert.equal(supabase.queries.length, 0);
});

test("the image response is never cacheable by a shared cache", async () => {
  const file = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
  const response = ogImageResponse({
    heroImage: { id: "first", storagePath: "page-1/first.jpg" },
    file,
  });
  const cacheControl = response.headers.get("cache-control");

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/jpeg");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(cacheControl, OG_IMAGE_CACHE_CONTROL);
  assert.match(cacheControl, /\bno-store\b/);
  assert.match(cacheControl, /\bprivate\b/);
  assert.doesNotMatch(cacheControl, /\bpublic\b|s-maxage|stale-while-revalidate/);
});

test("no hero image, no file or an unexpected type is a 404 that is not cached", () => {
  for (const args of [
    { heroImage: null, file: null },
    { heroImage: { id: "a", storagePath: "page-1/a.jpg" }, file: null },
    { heroImage: { id: "a", storagePath: "page-1/a.gif" }, file: new Blob([]) },
  ]) {
    const response = ogImageResponse(args);
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), OG_IMAGE_CACHE_CONTROL);
  }
});

test("the route is dynamic and sets no cache headers of its own", () => {
  const routeFile = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../src/app/(public-provider)/[username]/(storefront)/og-image/route.js",
  );
  const source = readFileSync(routeFile, "utf8").replace(/\/\/.*$/gm, "");

  assert.match(source, /export const dynamic = "force-dynamic"/);
  assert.doesNotMatch(source, /Cache-Control|s-maxage|revalidate/i);
  assert.match(source, /findPublishedHeroImage\(/);
  assert.match(source, /ogImageResponse\(/);
});
