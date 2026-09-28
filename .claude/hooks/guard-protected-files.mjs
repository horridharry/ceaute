// PreToolUse hook for Edit, Write and NotebookEdit. It denies:
// - any .env* file except .env.example, because those hold real credentials;
// - a migration that has already reached preview or main. Those are applied
//   (or about to be) to ceaute-dev and ceaute-prod, so a database change goes
//   in a new, later migration instead. Unmerged migrations stay editable.
// Bash edits bypass this hook; check-on-stop.mjs catches migration edits.
import { readFileSync, writeSync } from "node:fs";
import path from "node:path";

import { mergedRef } from "./merged-ref.mjs";

function denial(input) {
  const target = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (!target) return null;

  const file = path.resolve(input.cwd ?? process.cwd(), target);
  const name = path.basename(file);

  if (name.startsWith(".env") && name !== ".env.example") {
    return `${name} holds credentials and is edited only by the owner. Document a new variable in .env.example instead and tell the owner what to add.`;
  }

  const migration = file.match(/^(.*)\/supabase\/migrations\/([^/]+)$/);
  if (migration) {
    const [, root, fileName] = migration;
    const ref = mergedRef(root, `supabase/migrations/${fileName}`);
    if (ref) {
      return `supabase/migrations/${fileName} is already in ${ref}, so it may be applied to a real database. Do not change it: write a new migration with a later timestamp.`;
    }
  }

  return null;
}

const reason = denial(JSON.parse(readFileSync(0, "utf8")));
if (reason) {
  writeSync(
    1,
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
}
