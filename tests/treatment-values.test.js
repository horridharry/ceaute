import assert from "node:assert/strict";
import test from "node:test";
import {
  priceToPence,
  treatmentToProviderTreatment,
} from "../src/app/(dashboard)/dashboard/treatments/_lib/treatment-values.js";

test("converts a full treatment row into provider-facing form values", () => {
  const treatment = {
    id: "t1",
    provider_page_id: "p1",
    name: "Full Set",
    description: "Acrylic full set with shaping.",
    price_pence: 4500,
    duration_minutes: 90,
    discovery_category_id: "cat1",
    discovery_category: { name: "Nails" },
    treatment_group_id: "grp1",
    treatment_group: { name: "Classic" },
    is_active: true,
    image_url: "https://example.com/img.jpg",
    updated_at: "2026-01-01T00:00:00Z",
  };

  assert.deepEqual(treatmentToProviderTreatment(treatment), {
    treatmentId: "t1",
    providerPageId: "p1",
    name: "Full Set",
    description: "Acrylic full set with shaping.",
    price: 45,
    price_pence: 4500,
    duration: "00:01:30",
    duration_minutes: 90,
    discovery_category_id: "cat1",
    discovery_category_name: "Nails",
    treatment_group_id: "grp1",
    treatment_group_name: "Classic",
    is_active: true,
    image_url: "https://example.com/img.jpg",
    updated_at: "2026-01-01T00:00:00Z",
  });
});

test("fills in defaults for a sparse treatment row", () => {
  const treatment = {
    id: "t2",
    provider_page_id: "p2",
    name: "Basic",
    price_pence: null,
  };

  assert.deepEqual(treatmentToProviderTreatment(treatment), {
    treatmentId: "t2",
    providerPageId: "p2",
    name: "Basic",
    description: "",
    price: 0,
    price_pence: null,
    duration: "00:00:00",
    duration_minutes: 0,
    discovery_category_id: "",
    discovery_category_name: "",
    treatment_group_id: "",
    treatment_group_name: "",
    is_active: false,
    image_url: "",
    updated_at: undefined,
  });
});

test("priceToPence additionally rejects a zero price", () => {
  assert.equal(priceToPence("12.50"), 1250);
  assert.equal(priceToPence("0"), null);
  assert.equal(priceToPence("abc"), null);
});
