// Seeds the LOCAL database with two test accounts and a provider page that is
// ready to publish, so an agent can run publish → book → cancel → refund
// without the owner. Run it on a freshly reset local database:
//
//   npx supabase db reset && npm run local:seed
//
//   npm run local:seed -- --remember-stripe-account
//       after the provider has finished Stripe onboarding locally once: copies
//       their connected account id into .env.localstack, so every later seed
//       starts with payments ready.
//
// This is not supabase/seed.sql on purpose: `npm run test:db` needs a reset
// database with no extra rows (docs/verification.md, "Database tests").
import { deflateSync, crc32 } from "node:zlib";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { LOCAL_ENV_FILE, SEED, fail, localEnv, localStack, psql } from "./stack.mjs";

const stack = localStack();
const { providerUserId, customerUserId, providerPageId, providerEmail, customerEmail, username } = SEED;

if (process.argv.includes("--remember-stripe-account")) {
  const accountId = psql(
    stack,
    `select stripe_account_id from ceaute.provider_payment_account where provider_page_id = '${providerPageId}';`,
  ).trim();
  if (!accountId) fail("The local test provider has no Stripe account yet. Finish onboarding first.");
  const lines = existsSync(LOCAL_ENV_FILE)
    ? readFileSync(LOCAL_ENV_FILE, "utf8").split("\n").filter((line) => !line.startsWith("LOCAL_STRIPE_ACCOUNT_ID="))
    : [];
  writeFileSync(LOCAL_ENV_FILE, [...lines.filter(Boolean), `LOCAL_STRIPE_ACCOUNT_ID=${accountId}`, ""].join("\n"));
  console.log(`Saved ${accountId} to .env.localstack.`);
  process.exit(0);
}

const local = localEnv({ requireStripe: false });

const existing = psql(stack, `select count(*) from auth.users where email like '%@ceaute.test';`).trim();
if (existing !== "0") fail("Already seeded. Run `npx supabase db reset` first for a clean start.");

const admin = createClient(stack.apiUrl, stack.serviceRoleKey, { auth: { persistSession: false } });
for (const [id, email] of [[providerUserId, providerEmail], [customerUserId, customerEmail]]) {
  const { error } = await admin.auth.admin.createUser({ id, email, email_confirm: true });
  if (error) fail(`Could not create ${email}: ${error.message}`);
}

psql(
  stack,
  `
update ceaute.profile set full_name = 'Pat Provider', phone_e164 = '+447700900101' where id = '${providerUserId}';
update ceaute.profile set full_name = 'Casey Customer', phone_e164 = '+447700900102' where id = '${customerUserId}';

insert into ceaute.provider_page (id, owner_profile_id, username, display_name, provider_category, biography, status)
values ('${providerPageId}', '${providerUserId}', '${username}', 'Local Test Nails', 'Nails',
  'A made-up provider for local agent runs.', 'draft');

insert into ceaute.provider_location (provider_page_id, public_area, address_line_1, city, postcode, is_active, is_primary)
values ('${providerPageId}', 'Hackney, London', '1 Test Street', 'London', 'E8 1AA', true, true);

-- A flat £15 deposit, cancellation free up to 24 hours before (decision 008).
insert into ceaute.provider_booking_setting (provider_page_id, payment_mode, deposit_amount_pence, cancellation_window_hours)
values ('${providerPageId}', 'deposit', 1500, 24);

insert into ceaute.provider_agreement_acceptance (provider_page_id, agreement_version, accepted_by_profile_id)
values ('${providerPageId}', ceaute.current_provider_agreement_version(), '${providerUserId}');

insert into ceaute.treatment (provider_page_id, name, description, duration_minutes, price_pence, is_active, display_order, discovery_category_id)
select '${providerPageId}', t.name, t.description, t.minutes, t.pence, true, t.position,
  coalesce(
    (select id from ceaute.discovery_category where name = 'Gel nails'),
    (select id from ceaute.discovery_category order by name limit 1)
  )
from (values
  ('Gel manicure', 'Shape, cuticle care and gel colour.', 60, 3500, 1),
  ('Gel manicure with nail art', 'Gel colour with simple art on two nails.', 90, 5000, 2)
) as t(name, description, minutes, pence, position);

-- One drop, already open, releasing the next four weeks (decision 007).
insert into ceaute.availability_drop (id, provider_page_id, opens_at)
values ('5eed0000-0000-0000-0000-000000000020', '${providerPageId}', now() - interval '1 hour');

insert into ceaute.availability_date (provider_page_id, drop_id, local_date, hours_start, hours_end)
select '${providerPageId}', '5eed0000-0000-0000-0000-000000000020',
  (now() at time zone 'Europe/London')::date + offset_day, '09:00', '17:00'
from generate_series(1, 28) as offset_day;
`,
);

// A plain blush-coloured square, so the page has a visible portfolio photo.
function solidPng(size, [r, g, b]) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 2, 0, 0, 0], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(size * 3).fill(Buffer.from([r, g, b]))]);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(row.length * size).fill(row))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const imageId = "5eed0000-0000-0000-0000-000000000030";
const storagePath = `${providerPageId}/${imageId}.png`;
const upload = await fetch(`${stack.apiUrl}/storage/v1/object/portfolio-images/${storagePath}`, {
  method: "POST",
  headers: {
    apikey: stack.serviceRoleKey,
    authorization: `Bearer ${stack.serviceRoleKey}`,
    "content-type": "image/png",
  },
  body: solidPng(600, [232, 190, 180]),
});
if (!upload.ok) fail(`Portfolio photo upload failed: ${upload.status} ${await upload.text()}`);

psql(
  stack,
  `insert into ceaute.portfolio_image (id, provider_page_id, storage_path, caption, display_order, is_visible)
   values ('${imageId}', '${providerPageId}', '${storagePath}', 'Blush gel', 1, true);`,
);

// Payments: reuse the connected account from an earlier local onboarding.
let paymentsNote = "No LOCAL_STRIPE_ACCOUNT_ID yet: sign in as the provider and set up payments once.";
if (local.LOCAL_STRIPE_ACCOUNT_ID) {
  if (!/^(sk|rk)_test_/.test(local.STRIPE_SECRET_KEY ?? "")) fail("LOCAL_STRIPE_ACCOUNT_ID needs the sandbox key too.");
  process.env.STRIPE_MODE = "test";
  process.env.STRIPE_SECRET_KEY = local.STRIPE_SECRET_KEY;
  const { getStripe, retrieveStripeAccount, stripeAccountToPaymentAccount } = await import("@/lib/stripe/server");
  const account = stripeAccountToPaymentAccount(await retrieveStripeAccount(getStripe(), local.LOCAL_STRIPE_ACCOUNT_ID));
  const text = (value) => (value === null || value === undefined ? "null" : `'${String(value).replaceAll("'", "''")}'`);
  const array = (values) => `array[${values.map((v) => text(typeof v === "string" ? v : JSON.stringify(v))).join(",")}]::text[]`;
  psql(
    stack,
    `insert into ceaute.provider_payment_account (
       provider_page_id, stripe_account_id, dashboard, identity_country, recipient_applied,
       stripe_transfers_status, payouts_status, requirements_currently_due, requirements_past_due,
       requirements_eventually_due, last_stripe_update_at)
     values ('${providerPageId}', ${text(account.stripe_account_id)}, ${text(account.dashboard)},
       ${text(account.identity_country)}, ${account.recipient_applied},
       ${text(account.stripe_transfers_status)}, ${text(account.payouts_status)},
       ${array(account.requirements_currently_due)}, ${array(account.requirements_past_due)},
       ${array(account.requirements_eventually_due ?? [])}, now());`,
  );
  paymentsNote = `Payments: ${account.stripe_account_id} (transfers ${account.stripe_transfers_status}, payouts ${account.payouts_status}).`;
}

const checks = psql(
  stack,
  `set role service_role;
   select set_config('request.jwt.claim.role', 'service_role', false);
   select row_to_json(c) from ceaute.get_provider_page_publication_checks('${providerPageId}') c;`,
).trim().split("\n").pop();
const unmet = Object.entries(JSON.parse(checks))
  .filter(([name, value]) => value === false && /^(has_|payments_ready|agreement_accepted)/.test(name))
  .map(([name]) => name);

console.log(`Seeded provider ${providerEmail} (page @${username}, draft) and customer ${customerEmail}.`);
console.log(paymentsNote);
console.log(unmet.length ? `Not yet publishable: ${unmet.join(", ")}.` : "Every publication requirement is met; the page is ready to publish.");
console.log("Sign in with: npm run local:sign-in -- provider   (or customer)");
