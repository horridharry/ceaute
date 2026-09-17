import assert from "node:assert/strict";
import test from "node:test";
import { signStoragePaths } from "../src/lib/supabase/signed-urls.js";

function fakeStorage(respond) {
  const requests = [];

  return {
    requests,
    storage: {
      from(bucket) {
        return {
          async createSignedUrls(paths, expiresIn) {
            requests.push({ bucket, paths, expiresIn });
            return respond({ bucket, paths, expiresIn });
          },
        };
      },
    },
  };
}

test("signs every distinct path with one Storage request", async () => {
  const supabase = fakeStorage(({ paths }) => ({
    data: paths.map((path) => ({ path, signedUrl: `https://storage.test/${path}?token=1`, error: null })),
    error: null,
  }));

  const signed = await signStoragePaths(
    supabase,
    "portfolio-images",
    ["p/1.jpg", "p/2.jpg", "p/1.jpg", "", null],
    600,
  );

  assert.equal(supabase.requests.length, 1);
  assert.deepEqual(supabase.requests[0], {
    bucket: "portfolio-images",
    paths: ["p/1.jpg", "p/2.jpg"],
    expiresIn: 600,
  });
  assert.equal(signed.get("p/1.jpg"), "https://storage.test/p/1.jpg?token=1");
  assert.equal(signed.get("p/2.jpg"), "https://storage.test/p/2.jpg?token=1");
});

test("makes no request when there is nothing to sign", async () => {
  const supabase = fakeStorage(() => {
    throw new Error("should not be called");
  });

  const signed = await signStoragePaths(supabase, "portfolio-images", [], 600);

  assert.equal(signed.size, 0);
  assert.equal(supabase.requests.length, 0);
});

test("a path that cannot be signed is simply absent, and a failed request signs nothing", async () => {
  const partial = fakeStorage(({ paths }) => ({
    data: [
      { path: paths[0], signedUrl: "https://storage.test/ok", error: null },
      { path: paths[1], signedUrl: null, error: "Object not found" },
    ],
    error: null,
  }));

  const signed = await signStoragePaths(partial, "portfolio-images", ["ok.jpg", "missing.jpg"], 60);
  assert.equal(signed.get("ok.jpg"), "https://storage.test/ok");
  assert.equal(signed.has("missing.jpg"), false);

  const failed = fakeStorage(() => ({ data: null, error: new Error("storage down") }));
  const none = await signStoragePaths(failed, "portfolio-images", ["ok.jpg"], 60);
  assert.equal(none.size, 0);
});
