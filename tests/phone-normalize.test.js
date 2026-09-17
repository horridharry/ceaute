import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUkPhoneNumber } from "../src/lib/phone/normalize.js";

test("normalises the common ways a UK mobile number is typed to E.164", () => {
  assert.equal(normalizeUkPhoneNumber("07700 900123"), "+447700900123");
  assert.equal(normalizeUkPhoneNumber("(07700) 900-123"), "+447700900123");
  assert.equal(normalizeUkPhoneNumber("+44 7700 900123"), "+447700900123");
  assert.equal(normalizeUkPhoneNumber("447700900123"), "+447700900123");
  assert.equal(normalizeUkPhoneNumber("  +447700900123  "), "+447700900123");
});

test("rejects numbers that are not UK numbers or are the wrong length", () => {
  assert.equal(normalizeUkPhoneNumber(""), null);
  assert.equal(normalizeUkPhoneNumber(null), null);
  assert.equal(normalizeUkPhoneNumber("+1 415 555 0123"), null);
  assert.equal(normalizeUkPhoneNumber("077009001"), null);
  assert.equal(normalizeUkPhoneNumber("077009001234"), null);
  assert.equal(normalizeUkPhoneNumber("07700 9001x3"), null);
});
