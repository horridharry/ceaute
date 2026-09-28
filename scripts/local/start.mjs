// Builds and starts Ceaute on http://localhost:3100 against the local Supabase
// stack and the local-only Stripe sandbox, with Stripe events forwarded by the
// Stripe CLI. Emails are queued in the outbox but never sent: the Resend key is
// a placeholder and the local cron jobs have no base URL to call.
//
//   npm run local:start                 build, then start
//   npm run local:start -- --no-build   start the last local build
//   npm run local:start -- --no-stripe  no sandbox key yet: pages work, payments fail
//
// Every variable the app needs comes from appEnv in stack.mjs, so nothing is
// read from .env.local (which points at ceaute-dev).
import { spawn, spawnSync } from "node:child_process";
import { APP_ORIGIN, ROOT, appEnv, localEnv, localStack, stripeWebhookSecret } from "./stack.mjs";

const noStripe = process.argv.includes("--no-stripe");
const stack = localStack();
const local = localEnv({ requireStripe: !noStripe });
const port = new URL(APP_ORIGIN).port;
const stripeKey = noStripe ? "sk_test_local_stripe_not_configured" : local.STRIPE_SECRET_KEY;

const webhookSecret = noStripe ? "whsec_local_stripe_not_configured" : stripeWebhookSecret(stripeKey);

const overrides = appEnv({ stack, stripeKey, webhookSecret });
const env = { ...process.env, ...overrides };

if (!process.argv.includes("--no-build")) {
  const build = spawnSync("npm", ["run", "build"], { cwd: ROOT, env, stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

// The Stripe CLI needs the events named. Payment events are snapshot events
// (docs/stripe-preview-testing.md lists them); the Connect route receives v2
// thin events about provider accounts, so each gets its own listener.
const PAYMENT_EVENTS = [
  "checkout.session.completed", "checkout.session.expired",
  "payment_intent.payment_failed", "payment_intent.canceled",
  "refund.updated", "refund.failed",
  "charge.dispute.created", "charge.dispute.updated", "charge.dispute.closed",
  "charge.dispute.funds_withdrawn", "charge.dispute.funds_reinstated",
];
const listen = (flags, path) => spawn(
  "stripe",
  ["listen", ...flags, "--forward-to", `localhost:${port}${path}`],
  { cwd: ROOT, stdio: "inherit", env: { ...process.env, STRIPE_API_KEY: stripeKey } },
);

const children = [
  ...(noStripe ? [] : [
    listen(["--events", PAYMENT_EVENTS.join(",")], "/api/stripe/payments"),
    listen(["--all-thin"], "/api/stripe/connect"),
  ]),
  spawn("npx", ["next", "start", "-p", port], { cwd: ROOT, env, stdio: "inherit" }),
];

let stopping = false;
const stop = (code) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exit(code);
};
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
for (const child of children) {
  child.on("exit", (code) => {
    if (!stopping) console.error(`local:start: ${child.spawnargs.slice(0, 2).join(" ")} exited (${code}); stopping.`);
    stop(1);
  });
}
