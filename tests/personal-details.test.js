import assert from "node:assert/strict";
import test from "node:test";
import { parsePersonalDetails } from "../src/lib/profile/personal-details.js";

test("returns trimmed profile values with an E.164 phone number", () => {
  assert.deepEqual(
    parsePersonalDetails({ fullName: "  Ada Lovelace ", phone: "07700 900123" }),
    { values: { full_name: "Ada Lovelace", phone_e164: "+447700900123" } },
  );
});

test("rejects a missing or overlong name before touching the phone number", () => {
  assert.deepEqual(parsePersonalDetails({ fullName: "A", phone: "07700900123" }), {
    error: "Enter your full name.",
  });
  assert.deepEqual(
    parsePersonalDetails({ fullName: "x".repeat(121), phone: "07700900123" }),
    { error: "Full name must be 120 characters or fewer." },
  );
});

test("rejects a phone number PostgreSQL would not store", () => {
  assert.deepEqual(parsePersonalDetails({ fullName: "Ada Lovelace", phone: "123" }), {
    error: "Enter a valid phone number.",
  });
  assert.deepEqual(parsePersonalDetails({ fullName: "Ada Lovelace", phone: null }), {
    error: "Enter a valid phone number.",
  });
});
