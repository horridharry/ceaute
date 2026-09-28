// Stop hook: before Claude ends a turn that left code changes in the working
// tree, run the fast checks (typecheck, unit tests, about 6s together) and
// make sure no migration already in preview or main was modified, which
// catches Bash edits that bypass guard-protected-files.mjs. On failure Claude
// is sent back once to fix it; if the checks still fail on the retry, the
// owner is told instead, so the hook never loops. Lint (26s) and pgTAP (needs
// a local reset) stay manual steps from docs/verification.md.
import { execFileSync } from "node:child_process";
import { readFileSync, writeSync } from "node:fs";

import { mergedRef } from "./merged-ref.mjs";

const input = JSON.parse(readFileSync(0, "utf8"));
let root;
try {
  root = execFileSync("git", ["-C", input.cwd ?? process.cwd(), "rev-parse", "--show-toplevel"], {
    encoding: "utf8",
  }).trim();
} catch {
  process.exit(0);
}
const git = (...args) =>
  execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });

const changedPaths = git("status", "--porcelain", "--untracked-files=all")
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").pop());
const codeChanged = changedPaths.some(
  (file) => !file.startsWith("docs/") && !file.endsWith(".md"),
);
if (!codeChanged) process.exit(0);

const failures = [];

const editedMigrations = git("diff", "--diff-filter=M", "--name-only", "HEAD", "--", "supabase/migrations")
  .split("\n")
  .filter((file) => file && mergedRef(root, file));
if (editedMigrations.length > 0) {
  failures.push(
    `These migrations are already in preview or main and must not change:\n${editedMigrations.join("\n")}\nRestore them with git restore and put the change in a new migration.`,
  );
}

const env = { ...process.env, PATH: `${process.env.PATH}:/opt/homebrew/bin:/usr/local/bin` };
for (const script of ["typecheck", "test"]) {
  try {
    execFileSync("npm", ["run", script, "--silent"], {
      cwd: root,
      env,
      encoding: "utf8",
      stdio: "pipe",
    });
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`.trim().split("\n");
    failures.push(`npm run ${script} failed:\n${output.slice(-40).join("\n")}`);
  }
}

if (failures.length > 0) {
  const report = failures.join("\n\n");
  const result = input.stop_hook_active
    ? { systemMessage: `Checks still failing after one fix attempt:\n\n${report}` }
    : { decision: "block", reason: `Fix these before finishing:\n\n${report}` };
  writeSync(1, JSON.stringify(result));
}
