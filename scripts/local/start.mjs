// Builds and starts Ceaute on http://localhost:3100 against the local Supabase
// stack and the local-only Stripe sandbox, with Stripe events forwarded by the
// Stripe CLI. Emails are queued in the outbox but never sent: the Resend key is
// a placeholder and the local cron jobs have no base URL to call.
//
//   npm run local:start                 build, then start
//   npm run local:start -- --no-build   start the last local build
//   npm run local:start -- --no-stripe  no sandbox key yet: pages work, payments fail
//
// Every variable the app needs is set here, so nothing is read from .env.local
// (which points at ceaute-dev).
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { APP_ORIGIN, ROOT, fail, localEnv, localStack } from "./stack.mjs";

const noStripe = process.argv.includes("--no-stripe");
const stack = localStack();
const local = localEnv({ requireStripe: !noStripe });
const port = new URL(APP_ORIGIN).port;
const stripeKey = noStripe ? "sk_test_local_stripe_not_configured" : local.STRIPE_SECRET_KEY;

let webhookSecret = "whsec_local_stripe_not_configured";
if (!noStripe) try {
  webhookSecret = execFileSync(
    "stripe",
    ["listen", "--api-key", local.STRIPE_SECRET_KEY, "--print-secret"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();
} catch (error) {
  fail(`The Stripe CLI could not start a listener: ${error.stderr || error.message}`);
}

const overrides = {
  NEXT_PUBLIC_SUPABASE_URL: stack.apiUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
  SUPABASE_SERVICE_ROLE_KEY: stack.serviceRoleKey,
  STRIPE_MODE: "test",
  STRIPE_SECRET_KEY: stripeKey,
  STRIPE_PAYMENT_WEBHOOK_SECRET: webhookSecret,
  STRIPE_CONNECT_WEBHOOK_SECRET: webhookSecret,
  RESEND_API_KEY: "re_local_emails_are_not_sent",
  CEAUTE_EMAIL_FROM: "Ceaute Local <local@ceaute.test>",
  CEAUTE_APP_URL: APP_ORIGIN,
  CRON_SECRET: "local-cron-secret",
  CEAUTE_OPERATOR_EMAIL: "operator@ceaute.test",
  CEAUTE_OPERATOR_SECRET: "local-operator-secret",
};
const env = { ...process.env, ...overrides };

// If .env.example gains a variable, this fails rather than letting the value
// from .env.local (ceaute-dev) leak into a local run.
const required = [...readFileSync(join(ROOT, ".env.example"), "utf8").matchAll(/^([A-Z0-9_]+)=/gm)]
  .map((match) => match[1]);
const missing = required.filter((name) => !(name in overrides));
if (missing.length) fail(`scripts/local/start.mjs does not set: ${missing.join(", ")}`);

if (!process.argv.includes("--no-build")) {
  const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const children = [
  noStripe ? null : spawn(
    "stripe",
    [
      "listen",
      "--api-key", local.STRIPE_SECRET_KEY,
      "--forward-to", `localhost:${port}/api/stripe/payments`,
      "--forward-connect-to", `localhost:${port}/api/stripe/connect`,
    ],
    { cwd: ROOT, stdio: "inherit" },
  ),
  spawn("npx", ["next", "start", "-p", port], { cwd: ROOT, env, stdio: "inherit" }),
].filter(Boolean);

const stop = () => {
  for (const child of children) child.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
for (const child of children) child.on("exit", stop);
