import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveApplicationOrigin,
  resolveRequestOrigin,
} from "../src/lib/app/origin.js";

const productionAppUrl = "https://ceaute.com";
const previewAppUrl = "https://preview.ceaute.com";

test("Preview prefers its configured canonical origin over VERCEL_URL", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app",
      CEAUTE_APP_URL: previewAppUrl,
    }),
    previewAppUrl,
  );
});

test("an unconfigured Preview falls back to its generated VERCEL_URL", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app",
    }),
    "https://ceaute-abc123.vercel.app",
  );
});

test("Production resolves to the configured canonical origin", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "production",
      CEAUTE_APP_URL: productionAppUrl,
    }),
    productionAppUrl,
  );
});

test("Production ignores VERCEL_URL", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "production",
      VERCEL_URL: "ceaute-abc123.vercel.app",
      CEAUTE_APP_URL: productionAppUrl,
    }),
    productionAppUrl,
  );
});

test("local development resolves to the configured origin", () => {
  assert.equal(
    resolveApplicationOrigin({ CEAUTE_APP_URL: "http://localhost:3000" }),
    "http://localhost:3000",
  );
});

test("a local VERCEL_URL left in .env.local is ignored outside Preview", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_URL: "ceaute-abc123.vercel.app",
      CEAUTE_APP_URL: "http://localhost:3000",
    }),
    "http://localhost:3000",
  );
});

test("a trailing slash is stripped so callers can concatenate a path", () => {
  assert.equal(
    resolveApplicationOrigin({ CEAUTE_APP_URL: "https://ceaute.com/" }),
    productionAppUrl,
  );
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "preview",
      CEAUTE_APP_URL: `${previewAppUrl}/`,
      VERCEL_URL: "ceaute-ignored.vercel.app/",
    }),
    previewAppUrl,
  );
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app/",
    }),
    "https://ceaute-abc123.vercel.app",
  );
});

test("an unset or blank origin resolves to null rather than a broken URL", () => {
  assert.equal(resolveApplicationOrigin({}), null);
  assert.equal(resolveApplicationOrigin({ CEAUTE_APP_URL: "   " }), null);
  assert.equal(
    resolveApplicationOrigin({ VERCEL_ENV: "preview", VERCEL_URL: "  " }),
    null,
  );
});

// Stripe bakes success_url and cancel_url into the Checkout Session, so the
// origin these are built from decides where a paying customer lands.
function fakeHeaders(entries = {}) {
  return { get: (name) => entries[name] ?? null };
}

const hostileHeaders = fakeHeaders({
  origin: "https://attacker.example",
  host: "attacker.example",
  "x-forwarded-proto": "https",
});

test("Production Checkout URLs stay pinned to the canonical origin", () => {
  assert.equal(
    resolveRequestOrigin(hostileHeaders, {
      VERCEL_ENV: "production",
      CEAUTE_APP_URL: productionAppUrl,
    }),
    productionAppUrl,
  );
});

test("Production Checkout URLs ignore VERCEL_URL as well as the request headers", () => {
  assert.equal(
    resolveRequestOrigin(hostileHeaders, {
      VERCEL_ENV: "production",
      VERCEL_URL: "ceaute-abc123.vercel.app",
      CEAUTE_APP_URL: productionAppUrl,
    }),
    productionAppUrl,
  );
});

test("Preview Checkout URLs use the configured canonical origin", () => {
  assert.equal(
    resolveRequestOrigin(hostileHeaders, {
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app",
      CEAUTE_APP_URL: previewAppUrl,
    }),
    previewAppUrl,
  );
});

test("an unconfigured Preview Checkout URL uses the generated origin", () => {
  assert.equal(
    resolveRequestOrigin(hostileHeaders, {
      VERCEL_ENV: "preview",
      VERCEL_URL: "ceaute-abc123.vercel.app",
    }),
    "https://ceaute-abc123.vercel.app",
  );
});

test("local Checkout URLs use the configured origin", () => {
  assert.equal(
    resolveRequestOrigin(fakeHeaders({ origin: "http://127.0.0.1:3000" }), {
      CEAUTE_APP_URL: "http://localhost:3000",
    }),
    "http://localhost:3000",
  );
});

test("an unconfigured local run still falls back to the request origin", () => {
  assert.equal(
    resolveRequestOrigin(fakeHeaders({ origin: "http://localhost:3000" }), {}),
    "http://localhost:3000",
  );
});

test("the request fallback rebuilds the origin from host and forwarded protocol", () => {
  assert.equal(
    resolveRequestOrigin(
      fakeHeaders({ host: "localhost:3000", "x-forwarded-proto": "https" }),
      {},
    ),
    "https://localhost:3000",
  );
  assert.equal(
    resolveRequestOrigin(fakeHeaders({ host: "localhost:3000" }), {}),
    "http://localhost:3000",
  );
});

test("an unconfigured run with no usable headers refuses to guess an origin", () => {
  assert.throws(
    () => resolveRequestOrigin(fakeHeaders(), {}),
    /Could not determine the application origin\./,
  );
});

// A value pasted into a dashboard or .env file with its quotes attached reads
// back as correct but builds URLs that do not start with https://.
test("a quoted CEAUTE_APP_URL is unwrapped rather than propagated", () => {
  assert.equal(
    resolveApplicationOrigin({ CEAUTE_APP_URL: '"https://preview.ceaute.com"' }),
    previewAppUrl,
  );
  assert.equal(
    resolveApplicationOrigin({ CEAUTE_APP_URL: "'https://preview.ceaute.com/'" }),
    previewAppUrl,
  );
  assert.equal(
    resolveApplicationOrigin({ CEAUTE_APP_URL: '  "https://ceaute.com"  ' }),
    productionAppUrl,
  );
});

test("a quoted VERCEL_URL is unwrapped before the Preview fallback uses it", () => {
  assert.equal(
    resolveApplicationOrigin({
      VERCEL_ENV: "preview",
      VERCEL_URL: '"ceaute-abc123.vercel.app"',
    }),
    "https://ceaute-abc123.vercel.app",
  );
});

test("a configured origin that is not an absolute http(s) URL fails closed", () => {
  for (const value of [
    "preview.ceaute.com",
    "ftp://preview.ceaute.com",
    "javascript:alert(1)",
    "/dashboard",
  ]) {
    assert.throws(
      () => resolveApplicationOrigin({ CEAUTE_APP_URL: value }),
      /CEAUTE_APP_URL must be an absolute http\(s\) URL/,
      `expected ${value} to be rejected`,
    );
  }
});
