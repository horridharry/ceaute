import assert from "node:assert/strict";
import test from "node:test";
import {
  logSupabaseError,
  supabaseErrorDetails,
} from "../src/lib/supabase/log-error.js";
import { findPublishedHeroImage } from "../src/features/storefront/hero-image.js";

test("a PostgREST error keeps its code, message, details and hint", () => {
  assert.deepEqual(
    supabaseErrorDetails({
      code: "42703",
      message: "column provider_page.display_photo_path does not exist",
      details: null,
      hint: "Perhaps you meant ...",
    }),
    {
      name: null,
      code: "42703",
      message: "column provider_page.display_photo_path does not exist",
      details: null,
      hint: "Perhaps you meant ...",
      status: null,
      cause: null,
    },
  );
});

test("a network failure keeps its underlying cause code", () => {
  const error = new TypeError("fetch failed", {
    cause: Object.assign(new Error("connect ECONNRESET"), { code: "ECONNRESET" }),
  });

  const details = supabaseErrorDetails(error);
  assert.equal(details.name, "TypeError");
  assert.equal(details.message, "fetch failed");
  assert.equal(details.cause, "ECONNRESET");
});

test("logging writes only the error fields, under a context label", (t) => {
  const calls = [];
  t.mock.method(console, "error", (...args) => calls.push(args));

  logSupabaseError("published provider page lookup", { code: "PGRST000", message: "timeout" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "[supabase] published provider page lookup");
  assert.deepEqual(Object.keys(calls[0][1]).sort(), [
    "cause", "code", "details", "hint", "message", "name", "status",
  ]);
});

test("a failed lookup is logged server-side and thrown with its cause", async (t) => {
  const calls = [];
  t.mock.method(console, "error", (...args) => calls.push(args));
  const failure = { code: "PGRST301", message: "JWT expired" };
  const supabase = {
    schema() {
      return this;
    },
    from() {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: null, error: failure }),
      };
      return builder;
    },
  };

  await assert.rejects(findPublishedHeroImage(supabase, "ada"), (error) => {
    assert.equal(error.message, "Could not load provider page.");
    assert.equal(error.cause, failure);
    return true;
  });
  assert.equal(calls[0][0], "[supabase] hero image: provider page lookup");
  assert.equal(calls[0][1].message, "JWT expired");
});
