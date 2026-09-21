import assert from "node:assert/strict";
import test from "node:test";
import { providerPageToFormValues } from "../src/app/(dashboard)/dashboard/profile/_lib/provider-page-form-values.js";

test("converts a provider page row into form values", () => {
  const providerPage = {
    id: "page1",
    owner_profile_id: "user1",
    username: "glow.co",
    display_name: "Glow Co",
    provider_category: "Nails",
    biography: "Independent nail artist.",
    status: "draft",
  };

  assert.deepEqual(providerPageToFormValues(providerPage), {
    providerPageId: "page1",
    userId: "user1",
    username: "glow.co",
    businessName: "Glow Co",
    providerCategory: "Nails",
    biography: "Independent nail artist.",
    status: "draft",
  });
});

test("fills in defaults for unset provider page fields", () => {
  const providerPage = {
    id: "page2",
    owner_profile_id: "user2",
    status: "published",
  };

  assert.deepEqual(providerPageToFormValues(providerPage), {
    providerPageId: "page2",
    userId: "user2",
    username: "",
    businessName: "",
    providerCategory: "",
    biography: "",
    status: "published",
  });
});
