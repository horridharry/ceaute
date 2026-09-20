import assert from "node:assert/strict";
import test from "node:test";
import {
  PROVIDER_ONBOARDING_PATH,
  providerOnboardingPath,
  providerWorkspacePath,
} from "../src/lib/providers/onboarding-path.js";

test("a missing provider page preserves the requested setup destination", () => {
  assert.equal(
    providerOnboardingPath("/dashboard/locations?from=menu"),
    "/dashboard/onboarding?next=%2Fdashboard%2Flocations%3Ffrom%3Dmenu",
  );
  assert.equal(
    providerWorkspacePath("/dashboard/profile"),
    "/dashboard/profile",
  );
});

test("provider onboarding destinations stay inside the workspace", () => {
  assert.equal(providerWorkspacePath("https://evil.example"), null);
  assert.equal(providerWorkspacePath("//evil.example"), null);
  assert.equal(providerWorkspacePath("/account"), null);
  assert.equal(providerWorkspacePath(PROVIDER_ONBOARDING_PATH), null);
  assert.equal(
    providerWorkspacePath(`${PROVIDER_ONBOARDING_PATH}?next=/dashboard`),
    null,
  );
  assert.equal(providerOnboardingPath("/account"), PROVIDER_ONBOARDING_PATH);
});
