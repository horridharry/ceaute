// Shared helpers for the local agent scripts (docs/verification.md, "Local
// agent runs"). Everything here refuses to run unless the Supabase stack is the
// local one started by `npx supabase start`, so no script in this folder can
// reach ceaute-dev or production.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const APP_ORIGIN = "http://localhost:3100";
export const LOCAL_ENV_FILE = join(ROOT, ".env.localstack");

// Fixed ids so a reset and a fresh seed always give the same records.
// 5eed… does not collide with the pgTAP fixtures or the race scripts (0c…).
export const SEED = {
  providerUserId: "5eed0000-0000-0000-0000-000000000001",
  customerUserId: "5eed0000-0000-0000-0000-000000000002",
  providerPageId: "5eed0000-0000-0000-0000-000000000010",
  providerEmail: "provider@ceaute.test",
  customerEmail: "customer@ceaute.test",
  username: "local.nails",
};

export function fail(message) {
  console.error(message);
  process.exit(1);
}

function isLocalUrl(value) {
  try {
    const { hostname } = new URL(value);
    return ["127.0.0.1", "localhost", "[::1]"].includes(hostname);
  } catch {
    return false;
  }
}

// The running local stack's URLs and keys, from the Supabase CLI.
export function localStack() {
  let status;
  try {
    status = JSON.parse(
      execFileSync("npx", ["supabase", "status", "-o", "json"], {
        cwd: ROOT,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    fail("The local Supabase stack is not running. Start it with `npx supabase start`.");
  }

  if (!isLocalUrl(status.API_URL) || !isLocalUrl(status.DB_URL.replace(/^postgresql:/, "http:"))) {
    fail(`Refusing to run: ${status.API_URL} is not the local stack.`);
  }

  const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf8");
  const projectId = config.match(/^project_id\s*=\s*"([^"]+)"/m)?.[1];
  if (!projectId) fail("Could not read project_id from supabase/config.toml.");

  return {
    apiUrl: status.API_URL,
    publishableKey: status.PUBLISHABLE_KEY,
    serviceRoleKey: status.SERVICE_ROLE_KEY,
    mailpitUrl: status.MAILPIT_URL,
    dbContainer: `supabase_db_${projectId}`,
  };
}

// Runs SQL as postgres inside the local database container. Returns stdout.
export function psql(stack, sql, { tuples = true } = {}) {
  return execFileSync(
    "docker",
    [
      "exec", "-i", stack.dbContainer,
      "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q",
      ...(tuples ? ["-At", "-F", "\t"] : []),
    ],
    { input: sql, encoding: "utf8" },
  );
}

// .env.localstack holds the local-only Stripe sandbox key (never the key of
// the sandbox Preview uses) and, once onboarding is done, the test provider's
// connected account. It is gitignored by the `.env*` rule.
export function localEnv({ requireStripe = true } = {}) {
  const values = {};
  if (existsSync(LOCAL_ENV_FILE)) {
    for (const line of readFileSync(LOCAL_ENV_FILE, "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (match) values[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }

  const key = values.STRIPE_SECRET_KEY ?? "";
  if (requireStripe && !/^(sk|rk)_test_/.test(key)) {
    fail(
      "Put the LOCAL Stripe sandbox's test secret key in .env.localstack as\n" +
        "STRIPE_SECRET_KEY=sk_test_… (see docs/verification.md, \"Local agent runs\").",
    );
  }
  if (key && !/^(sk|rk)_test_/.test(key)) {
    fail("Refusing to run: STRIPE_SECRET_KEY in .env.localstack is not a test key.");
  }

  return values;
}
