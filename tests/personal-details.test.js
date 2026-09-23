import assert from "node:assert/strict";
import test from "node:test";
import { formatUkPhoneNumber } from "../src/lib/phone/normalize.js";
import { parsePersonalDetails, validatePersonalDetails } from "../src/lib/profile/personal-details.js";

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
    error: "Enter a UK phone number, like 07700 900482.",
  });
  assert.deepEqual(parsePersonalDetails({ fullName: "Ada Lovelace", phone: null }), {
    error: "Enter your mobile number.",
  });
});

test("reports each field's problem beside its own input", () => {
  assert.deepEqual(validatePersonalDetails({ fullName: "A", phone: "" }), {
    errors: {
      full_name: "Enter your full name.",
      phone: "Enter your mobile number.",
    },
  });
  assert.deepEqual(validatePersonalDetails({ fullName: " Ada Lovelace ", phone: "07700 900482" }), {
    values: { full_name: "Ada Lovelace", phone_e164: "+447700900482" },
  });
});

test("shows a stored number the way people write it", () => {
  assert.equal(formatUkPhoneNumber("+447700900482"), "07700 900482");
  assert.equal(formatUkPhoneNumber("+442079460000"), "02079 460000");
  assert.equal(formatUkPhoneNumber("not a number"), "not a number");
  assert.equal(formatUkPhoneNumber(null), "");
});
