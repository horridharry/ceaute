// Prints a one-time sign-in link for a seeded LOCAL test account, so an agent
// can sign in without a password or an email code (docs/verification.md,
// "Local agent runs"). Only @ceaute.test addresses on the local stack.
//
//   npm run local:sign-in -- provider [/dashboard/settings/publication]
//   npm run local:sign-in -- customer [/@local.nails]
//
// Open the printed link in the browser pane. A new link signs out whoever was
// signed in before.
import { createClient } from "@supabase/supabase-js";
import { APP_ORIGIN, SEED, fail, localStack } from "./stack.mjs";

const [who = "", next = ""] = process.argv.slice(2);
const email = { provider: SEED.providerEmail, customer: SEED.customerEmail }[who] ?? who;
if (!email.endsWith("@ceaute.test")) fail("Usage: npm run local:sign-in -- provider|customer|<name>@ceaute.test [next-path]");
if (next && !/^\/(?!\/)/.test(next)) fail("The next path must start with a single /.");

const stack = localStack();
const admin = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false } });
const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
if (error) fail(`Could not create a sign-in link for ${email}: ${error.message}. Is it seeded?`);

const link = new URL("/auth/confirm", APP_ORIGIN);
link.searchParams.set("token_hash", data.properties.hashed_token);
link.searchParams.set("type", "magiclink");
if (next) link.searchParams.set("next", next);
console.log(link.toString());
