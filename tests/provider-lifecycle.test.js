import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
  addOnTransitionOutcome,
  blockedGroupMessage,
  groupTransitionOutcome,
  isTransition,
} from "../src/app/(dashboard)/dashboard/_lib/lifecycle-outcome.js";
import { deleteRowThenFile } from "../src/app/(dashboard)/dashboard/profile/portfolio/_lib/portfolio-deletion.js";
import {
  LAST_VISIBLE_PHOTO_MESSAGE,
  describePortfolioChangeError,
} from "../src/app/(dashboard)/dashboard/profile/portfolio/_lib/portfolio-messages.js";

test("only archive, restore and delete are transitions", () => {
  assert.equal(isTransition("archive"), true);
  assert.equal(isTransition("restore"), true);
  assert.equal(isTransition("delete"), true);
  assert.equal(isTransition("purge"), false);
  assert.equal(isTransition(""), false);
});

test("a successful add-on transition says where the add-on went", () => {
  assert.deepEqual(addOnTransitionOutcome({ transition: "archive", name: "Gel removal" }), {
    status: "done",
    message: "Gel removal archived. Find it under Archived.",
  });
  assert.deepEqual(addOnTransitionOutcome({ transition: "restore", name: "Gel removal" }), {
    status: "done",
    message: "Gel removal restored. Find it under Active.",
  });
  assert.deepEqual(addOnTransitionOutcome({ transition: "delete", name: "French tips" }), {
    status: "done",
    message: "French tips deleted.",
  });
});

test("deleting an active add-on is explained, not shown as a raw error", () => {
  assert.deepEqual(
    addOnTransitionOutcome({ transition: "delete", name: "Gel removal", error: { code: "CE010" } }),
    { status: "error", message: "Archive this add-on before deleting it." },
  );
});

test("a deleted or foreign add-on is reported as gone", () => {
  assert.deepEqual(
    addOnTransitionOutcome({ transition: "restore", name: "French tips", error: { code: "CE002" } }),
    { status: "error", message: "That add-on no longer exists." },
  );
});

test("an unexpected add-on failure never leaks database text", () => {
  const outcome = addOnTransitionOutcome({
    transition: "archive",
    name: "Gel removal",
    error: { code: "XX000", message: "internal detail" },
  });
  assert.equal(outcome.status, "error");
  assert.doesNotMatch(outcome.message, /internal detail/);
});

test("a group that still has treatments is blocked, not failed", () => {
  assert.deepEqual(
    groupTransitionOutcome({ transition: "archive", name: "Extensions", error: { code: "CE011" } }),
    { status: "blocked", message: "" },
  );
  assert.equal(
    groupTransitionOutcome({ transition: "delete", name: "Bridal", error: { code: "CE010" } }).message,
    "Archive this group before deleting it.",
  );
  assert.equal(
    groupTransitionOutcome({ transition: "restore", name: "Bridal", error: { code: "CE012" } }).message,
    "That treatment group no longer exists.",
  );
});

test("the blocked explanation counts archived treatments as dependencies", () => {
  assert.deepEqual(
    blockedGroupMessage({
      transition: "archive",
      name: "Extensions",
      treatments: [
        { id: "a", name: "Acrylic full set", is_active: true },
        { id: "b", name: "Gel-X full set", is_active: true },
        { id: "c", name: "Stiletto sculpt", is_active: false },
      ],
    }),
    {
      title: "Extensions can’t be archived yet",
      body: "It still contains 3 treatments, including 1 archived. Move each one to another group or to No group, then try again.",
    },
  );
  assert.equal(
    blockedGroupMessage({
      transition: "delete",
      name: "Bridal",
      treatments: [{ id: "d", name: "Bridal trial", is_active: false }],
    }).body,
    "It still contains 1 archived treatment. Move each one to another group or to No group, then try again.",
  );
});

test("a photo's database row is deleted before its stored file", async () => {
  const calls = [];
  const result = await deleteRowThenFile({
    deleteRow: async () => {
      calls.push("row");
      return { error: null };
    },
    removeFile: async () => {
      calls.push("file");
      return { error: null };
    },
    onOrphan: () => calls.push("orphan"),
  });

  assert.deepEqual(calls, ["row", "file"]);
  assert.deepEqual(result, { status: "deleted", orphaned: false });
});

test("a refused row delete leaves the stored file alone", async () => {
  let fileRemoved = false;
  const refusal = { code: "CE013" };
  const result = await deleteRowThenFile({
    deleteRow: async () => ({ error: refusal }),
    removeFile: async () => {
      fileRemoved = true;
      return { error: null };
    },
    onOrphan: () => {},
  });

  assert.equal(fileRemoved, false);
  assert.deepEqual(result, { status: "refused", error: refusal });
  assert.equal(describePortfolioChangeError(refusal, "fallback"), LAST_VISIBLE_PHOTO_MESSAGE);
});

test("a storage clean-up failure after the row is gone is reported, not surfaced", async () => {
  const orphans = [];
  const result = await deleteRowThenFile({
    deleteRow: async () => ({ error: null }),
    removeFile: async () => ({ error: { message: "storage unavailable" } }),
    onOrphan: (error) => orphans.push(error.message),
  });

  assert.deepEqual(result, { status: "deleted", orphaned: true });
  assert.deepEqual(orphans, ["storage unavailable"]);
});

test("other portfolio failures keep their own message", () => {
  assert.equal(describePortfolioChangeError({ code: "42501" }, "Could not update that image."), "Could not update that image.");
});

// Since 202609220002 only the transition functions may change is_active or
// deleted_at on add-ons and groups; a direct write would fail with 42501.
function sourceFiles(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(js|jsx|ts|tsx)$/.test(entry) ? [path] : [];
  });
}

test("no application code writes add-on or group state directly", () => {
  const offenders = sourceFiles("src").filter((path) => {
    const source = readFileSync(path, "utf8");
    return /from\("treatment_(add_on|group)"\)[\s\S]{0,200}?\.(update|insert|upsert)\(\{[^}]*(is_active|deleted_at)/.test(source);
  });

  assert.deepEqual(offenders, []);
});

test("add-on and group transitions go through the database functions", () => {
  const addOns = readFileSync("src/app/(dashboard)/dashboard/add-ons/actions.js", "utf8");
  const groups = readFileSync("src/app/(dashboard)/dashboard/treatment-groups/actions.js", "utf8");

  assert.match(addOns, /rpc\("transition_treatment_add_on"/);
  assert.match(groups, /rpc\("transition_treatment_group"/);
  assert.doesNotMatch(addOns + groups, /\.delete\(\)/);
});
