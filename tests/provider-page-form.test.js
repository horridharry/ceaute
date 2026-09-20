import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  isProviderCategory,
  providerPageValuesFromFormData,
} from "../src/app/(dashboard)/dashboard/profile/_lib/provider-page-form-values.js";

test("provider category is preserved in the provider-page update payload", () => {
  const formData = new FormData();
  formData.set("business_name", "  Studio One  ");
  formData.set("username", " Studio One ");
  formData.set("provider_category", "Hair");
  formData.set("biography", "  Independent stylist.  ");

  const result = providerPageValuesFromFormData(formData);

  assert.equal(result.providerCategory, "Hair");
  assert.deepEqual(result.providerPageValues, {
    username: "studioone",
    display_name: "Studio One",
    provider_category: "Hair",
    biography: "Independent stylist.",
  });
  assert.equal(isProviderCategory(result.providerCategory), true);
  assert.equal(isProviderCategory("Tattoo"), false);
});

test("blank provider category is intentionally persisted as null", () => {
  const result = providerPageValuesFromFormData(new FormData());

  assert.equal(result.providerCategory, "");
  assert.equal(result.providerPageValues.provider_category, null);
});

test("provider-page form opts out of React's post-action reset", () => {
  const componentSource = readFileSync(
    new URL(
      "../src/app/(dashboard)/dashboard/profile/_components/provider-page-form.jsx",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(
    componentSource,
    /onSubmit=\{keepFormValuesOnSubmit\(updateProviderPageAction\)\}/,
  );
  assert.match(componentSource, /value=\{providerCategory\}/);
  assert.match(
    componentSource,
    /onChange=\{\(event\) => setProviderCategory\(event\.target\.value\)\}/,
  );
});
