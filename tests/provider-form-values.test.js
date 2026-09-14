import assert from "node:assert/strict";
import test from "node:test";
import {
  getIdList,
  getOptionalId,
  getString,
  normalizeName,
} from "../src/app/(dashboard)/dashboard/_lib/form-values.js";

test("reads a trimmed string and an absent field as empty", () => {
  const formData = new FormData();
  formData.set("name", "  Chrome finish  ");

  assert.equal(getString(formData, "name"), "Chrome finish");
  assert.equal(getString(formData, "description"), "");
});

test("reads an unselected optional relationship as null", () => {
  const formData = new FormData();
  formData.set("treatment_group_id", "   ");

  assert.equal(getOptionalId(formData, "treatment_group_id"), null);

  formData.set("treatment_group_id", "26000000-0000-0000-0000-000000000001");
  assert.equal(
    getOptionalId(formData, "treatment_group_id"),
    "26000000-0000-0000-0000-000000000001",
  );
});

test("collects checked compatibility IDs without blanks or duplicates", () => {
  const formData = new FormData();

  assert.deepEqual(getIdList(formData, "compatibleTreatmentIds"), []);

  for (const value of ["treatment-a", " treatment-b ", "", "treatment-a"]) {
    formData.append("compatibleTreatmentIds", value);
  }

  assert.deepEqual(getIdList(formData, "compatibleTreatmentIds"), [
    "treatment-a",
    "treatment-b",
  ]);
});

test("compares provider-facing names the way PostgreSQL's unique indexes do", () => {
  assert.equal(normalizeName("  Full Sets  "), "full sets");
  assert.equal(normalizeName(null), "");
});
