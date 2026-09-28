// Shared by the hooks: the first protected branch that already contains a
// file, or null. A migration in any of these may be applied to a real database.
import { execFileSync } from "node:child_process";

const PROTECTED_REFS = ["origin/main", "main", "origin/preview", "preview"];

export function mergedRef(root, relativePath) {
  for (const ref of PROTECTED_REFS) {
    try {
      execFileSync("git", ["-C", root, "cat-file", "-e", `${ref}:${relativePath}`], {
        stdio: "ignore",
      });
      return ref;
    } catch {
      // Not in this ref, or the ref does not exist in this clone.
    }
  }
  return null;
}
