import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeUsername,
  usernameRequiredError,
  validateUsername,
} from "../src/lib/providers/username.js";

test("a published page cannot clear its username, matching the database constraint", () => {
  assert.match(
    usernameRequiredError({ username: "", status: "published" }),
    /published page needs a username/,
  );
  assert.equal(usernameRequiredError({ username: "glow.co", status: "published" }), null);
  assert.equal(usernameRequiredError({ username: "", status: "draft" }), null);
  assert.equal(usernameRequiredError({ username: "", status: "suspended" }), null);
});

test("derives a username from a business name the way PostgreSQL accepts it", () => {
  assert.equal(normalizeUsername("  Glow & Co. Lashes "), "glowco.lashes");
  assert.equal(normalizeUsername("Ana_Maria Nails!"), "ana_marianails");
  assert.equal(normalizeUsername(null), "");
  assert.equal(normalizeUsername("x".repeat(40)).length, 30);
});

test("accepts usernames that satisfy the database format check", () => {
  assert.equal(validateUsername("glow.co_1"), null);
  assert.equal(validateUsername("abc"), null);
  assert.equal(validateUsername("a".repeat(30)), null);
});

test("rejects usernames that PostgreSQL would reject", () => {
  assert.match(validateUsername("ab"), /between 3 and 30/);
  assert.match(validateUsername("a".repeat(31)), /between 3 and 30/);
  assert.match(validateUsername("Glow Co"), /lowercase letters/);
});

test("leaves an empty username to the caller", () => {
  assert.equal(validateUsername(""), null);
});
