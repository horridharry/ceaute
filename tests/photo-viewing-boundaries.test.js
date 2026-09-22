import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The shared photo viewer is used by the public gallery and the provider's
// portfolio page without either depending on the other: the shared module
// imports nothing from app routes, the dashboard or Supabase, and portfolio
// management stays in the dashboard.

const REPO_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const SHARED_DIR = path.join(REPO_ROOT, "src/features/photo-viewing");
const read = (relativePath) => readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

test("the shared photo-viewing module depends on nothing app-, dashboard- or data-specific", () => {
  for (const file of readdirSync(SHARED_DIR)) {
    const source = readFileSync(path.join(SHARED_DIR, file), "utf8");
    const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);

    for (const specifier of specifiers) {
      assert.ok(
        specifier === "react" || specifier.startsWith("./"),
        `${file} imports ${specifier}`,
      );
    }
  }
});

test("the gallery and the provider's portfolio both use the shared viewer", () => {
  assert.match(read("src/features/storefront/photo-gallery.jsx"), /from "@\/features\/photo-viewing\/photo-viewer"/);
  assert.match(
    read("src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-page-ui.jsx"),
    /from "@\/features\/photo-viewing\/photo-viewer"/,
  );
});

test("portfolio management stays in the dashboard and out of the shared viewer", () => {
  const dashboard = read("src/app/(dashboard)/dashboard/profile/portfolio/_components/portfolio-page-ui.jsx");
  for (const action of ["uploadPortfolioImage", "movePortfolioImage", "setPortfolioImageVisibility", "deletePortfolioImage", "updatePortfolioImageCaption"]) {
    assert.match(dashboard, new RegExp(action), `${action} still wired in the dashboard`);
  }

  for (const file of readdirSync(SHARED_DIR)) {
    const source = readFileSync(path.join(SHARED_DIR, file), "utf8");
    assert.doesNotMatch(source, /upload|delete|visibility|Portfolio(Image)?\(/i, `${file} has no management`);
  }
});
