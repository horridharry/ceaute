# Test data reset plan — 17 September 2026

Status: **proposal, nothing executed.** Branch `chore/reset-test-data-plan`.
Goal: remove every disposable test user and the application data they created
through the deployed site so a completely fresh signup can be exercised, while
keeping source code, schema, migrations, configuration, secrets, seed data and
Stripe configuration intact.

## 1. Findings

### 1.1 Which Supabase project the deployed site uses

| Evidence | Value |
| --- | --- |
| `.env.local` `NEXT_PUBLIC_SUPABASE_URL` | `https://fgnusdbpuvndilryvudc.supabase.co` |
| `supabase/.temp/linked-project.json` | ref `fgnusdbpuvndilryvudc`, name **`ceaute-dev`** |
| Stripe test webhook endpoint (`we_1UFtmz…`) | `https://ceaute.com/api/stripe/payments` |
| Stripe Connect event destination (`ed_test_61VPHh…`) | `https://ceaute.com/api/stripe/connect` |
| Stripe Checkout Session `cs_test_a10puHKu…` metadata `booking_id` | `d81bcecf-20ca-41de-b94e-deedce76a24e` — this row exists in `ceaute.booking` on `ceaute-dev` |
| Stripe connected account `acct_1UG6mOAQCiichWVj` metadata `provider_page_id` | `cec362b0-…` — this row exists in `ceaute.provider_page` on `ceaute-dev` |
| `X-Vercel-Id` from `https://ceaute.com` | `lhr1::dub1::…` (functions now in Dublin) |

Random UUIDs written by ceaute.com into Stripe metadata match rows in
`ceaute-dev`, so **ceaute.com writes to `ceaute-dev` (`fgnusdbpuvndilryvudc`)**.
The client bundle does not embed the Supabase URL (Supabase is only called
server-side), so it cannot be read from the page source.

**Safe identity check before executing:** in Vercel → Project → Settings →
Environment Variables, confirm `NEXT_PUBLIC_SUPABASE_URL` for Production equals
`https://fgnusdbpuvndilryvudc.supabase.co`. Every script in this plan must print
the project host and refuse to run unless it equals that value.

There is **no separate production Supabase project** and no live Stripe keys;
`ceaute-dev` is simultaneously the alpha database (already flagged in
`docs/reports/2026-09-16-latency-tests-alpha-readiness.md`, open item 1).

### 1.2 Stripe mode

`STRIPE_SECRET_KEY` starts with `sk_test_`; the platform account is
`acct_1UFtYOAQCi6m6Wd8` ("Ceaute Dev", GB). Both webhook destinations are test
mode. Everything below is **test mode only**; no live money is involved.

### 1.3 Data inventory (read-only, 17 Sep 2026)

Supabase `ceaute-dev`:

| Object | Count | Notes |
| --- | --- | --- |
| `auth.users` | 2 | `ndu.harry02@gmail.com` (owner of the provider page), `dmeleki1@gmail.com` (customer, never signed in) |
| `ceaute.profile` | 2 | one per auth user (trigger-created) |
| `ceaute.provider_page` | 1 | `@barrison`, `status = draft`, `published_at` set |
| treatment / add_on / compatibility / group | 2 / 1 / 1 / 0 | |
| availability_rule / blocked_date / provider_location / provider_booking_setting | 4 / 1 / 1 / 1 | |
| `ceaute.portfolio_image` | 1 | `portfolio-images/cec362b0-…/…` |
| `ceaute.provider_payment_account` | 1 | `acct_1UG6mOAQCiichWVj`, transfers + payouts active |
| `ceaute.booking` | 1 | **`confirmed`**, starts 2026-09-23 08:30 UTC |
| `ceaute.booking_payment_attempt` | 1 | `succeeded`, £15.00, `pi_3UG70DAQCi6m6Wd81mZufc1v` |
| `ceaute.booking_email_outbox` | 2 | both `sent` |
| `ceaute.booking_review` | 0 | |
| `ceaute.booking_refund_operation`, `stripe_payment_event`, `stripe_connect_event` | not readable via service role | must be inspected in the SQL editor (step 3.2) |
| `ceaute.discovery_category` | 15 | **seed data — keep** |
| Storage `portfolio-images` (private) | 1 object | under prefix `cec362b0-…` |
| Storage `treatment-images` (public) | 0 objects | bucket row kept by migrations |

Stripe test mode:

| Object | Count | Notes |
| --- | --- | --- |
| Connected accounts (v2, express dashboard) | 1 | `acct_1UG6mOAQCiichWVj`, metadata `provider_page_id` |
| Customers | 0 | Checkout uses `customer_creation: if_required`; none created |
| PaymentIntents / Charges | 1 / 1 | succeeded, £15.00, `transfer_data.destination` = connected account |
| Transfers | 1 | `tr_3UG70DAQCi6m6Wd81GMtXuuk`, £15.00 to the connected account, not reversed |
| Refunds / Disputes / open Checkout Sessions | 0 / 0 / 0 | |
| Events with failed or pending delivery | 0 | `pending_webhooks = 0` on every recent event |

### 1.4 Relationships that constrain deletion (from the migrations)

- `ceaute.profile.id → auth.users(id)` is **ON DELETE RESTRICT** and the
  `auth_user_create_profile` trigger guarantees a profile per user, so
  `auth.admin.deleteUser()` fails until the profile row is gone.
- Every user-data FK is RESTRICT except `availability_rule` and `blocked_date`
  (CASCADE from `provider_page`) and `stripe_payment_event.booking_payment_attempt_id`
  (SET NULL). `booking.confirming_payment_attempt_id ↔ booking_payment_attempt.booking_id`
  is a mutual RESTRICT cycle that must be broken by nulling the booking column.
- `service_role` has **no DELETE grant** on any `ceaute` table, so the cleanup
  must run as `postgres` (Supabase SQL editor), not through the app's
  service-role client.
- Stripe identifiers live in `provider_payment_account.stripe_account_id`,
  `booking_payment_attempt.{stripe_checkout_session_id, stripe_payment_intent_id, provider_stripe_account_id, stripe_refund_id}`,
  `booking_refund_operation.{stripe_refund_id, stripe_payment_intent_id, stripe_charge_id}`,
  and the event ledgers `stripe_payment_event.id` / `stripe_connect_event.id` (`evt_…`).
- No Stripe customer id is stored anywhere.

### 1.5 Background work that could recreate records

| Source | What it does | Reset risk |
| --- | --- | --- |
| Stripe payment webhook → `/api/stripe/payments` | claims `evt_…` into `stripe_payment_event`, then calls booking RPCs | A late `refund.updated` / `checkout.session.*` for deleted rows fails, is stored as `failed`, and Stripe retries for up to 3 days |
| Stripe Connect destination → `/api/stripe/connect` | looks up `provider_payment_account`; unknown account ⇒ event marked `ignored` | Harmless after reset (row inserted into `stripe_connect_event` only) |
| pg_cron `ceaute-complete-bookings` (hourly) | `complete_elapsed_bookings` | Nothing to do on empty tables |
| pg_cron `ceaute-send-booking-emails` (every 10 min) | claims `booking_email_outbox` rows and calls Resend | Could hold a row lock mid-reset; nothing pending today |
| pg_cron `ceaute-recover-booking-refunds` (every 10 min) | drives `booking_refund_operation` rows through Stripe | Could create a Stripe refund during the window if a `requested`/`pending` operation exists |

### 1.6 Is deletion safe right now?

- No open Checkout Session, no pending refund, no undelivered Stripe event,
  no `sending` email. **Nothing is in flight.**
- One **confirmed, paid, future booking** (£15 test money already transferred
  to the connected account). Deleting it leaves the Stripe PaymentIntent,
  Charge and Transfer orphaned. That is acceptable in test mode, but it is a
  product decision (see §4, decision A).
- Three tables could not be inspected from here. Step 3.2 verifies they hold
  no `requested`, `pending` or `processing` refund operations and no
  `received`/`processing` webhook events before anything is deleted.

## 2. What is preserved

Source code, all `supabase/migrations`, `supabase/config.toml`, every Vercel
and `.env.local` secret, Supabase Vault secrets (`ceaute_cron_secret`,
`ceaute_cron_base_url`), the three pg_cron job definitions, both Stripe
webhook destinations and their signing secrets, the Stripe platform account,
`ceaute.discovery_category` (15 rows), both `storage.buckets` rows, all RLS
policies, functions and triggers. Only rows and objects are removed.

## 3. Reset procedure (ordered)

Run steps 3.1–3.4 first; they change nothing. Steps 3.5 onward are
destructive and need the approvals in §4.

### 3.1 Freeze incoming work (reversible)

1. Supabase SQL editor: `update cron.job set active = false where jobname like 'ceaute-%';`
   (keeps schedules; re-enable with `active = true`).
2. Stripe Dashboard (test mode) → Developers → Webhooks: **disable** the
   endpoint for `/api/stripe/payments` and the event destination for
   `/api/stripe/connect`. Re-enable after §3.8. Equivalent API calls:
   `webhookEndpoints.update(id, { disabled: true })` and
   `v2.core.eventDestinations.disable(id)`.
3. Do not use ceaute.com (no sign-ins, bookings, cancellations or Stripe
   onboarding) until §3.8.

### 3.2 Pre-flight checks (SQL editor, read-only)

```sql
select count(*) from ceaute.booking_refund_operation
 where status in ('requested','processing','pending');            -- must be 0
select count(*) from ceaute.stripe_payment_event
 where processing_status in ('received','processing');            -- must be 0
select count(*) from ceaute.stripe_connect_event
 where processing_status in ('received','processing');            -- must be 0
select count(*) from ceaute.booking_email_outbox
 where delivery_status in ('pending','sending','failed');         -- must be 0
select count(*) from ceaute.booking_payment_attempt
 where payment_status in ('created','checkout_creating','checkout_created'); -- must be 0
select id, email from auth.users order by created_at;             -- must list only the two test users
```

Abort if any count is non-zero or an unexpected user appears.

### 3.3 Backup

No Docker and no `pg_dump` on this machine, so `supabase db dump` is not
available. Use these instead:

1. **Database:** SQL editor, run and download the result as JSON:
   ```sql
   select jsonb_build_object(
     'auth_users', (select jsonb_agg(u) from auth.users u),
     'auth_identities', (select jsonb_agg(i) from auth.identities i),
     'profile', (select jsonb_agg(t) from ceaute.profile t),
     'provider_page', (select jsonb_agg(t) from ceaute.provider_page t),
     'treatment_group', (select jsonb_agg(t) from ceaute.treatment_group t),
     'treatment', (select jsonb_agg(t) from ceaute.treatment t),
     'treatment_add_on', (select jsonb_agg(t) from ceaute.treatment_add_on t),
     'treatment_add_on_compatibility', (select jsonb_agg(t) from ceaute.treatment_add_on_compatibility t),
     'availability_rule', (select jsonb_agg(t) from ceaute.availability_rule t),
     'blocked_date', (select jsonb_agg(t) from ceaute.blocked_date t),
     'provider_location', (select jsonb_agg(t) from ceaute.provider_location t),
     'portfolio_image', (select jsonb_agg(t) from ceaute.portfolio_image t),
     'provider_booking_setting', (select jsonb_agg(t) from ceaute.provider_booking_setting t),
     'provider_payment_account', (select jsonb_agg(t) from ceaute.provider_payment_account t),
     'booking', (select jsonb_agg(t) from ceaute.booking t),
     'booking_payment_attempt', (select jsonb_agg(t) from ceaute.booking_payment_attempt t),
     'booking_refund_operation', (select jsonb_agg(t) from ceaute.booking_refund_operation t),
     'booking_email_outbox', (select jsonb_agg(t) from ceaute.booking_email_outbox t),
     'booking_review', (select jsonb_agg(t) from ceaute.booking_review t),
     'stripe_payment_event', (select jsonb_agg(t) from ceaute.stripe_payment_event t),
     'stripe_connect_event', (select jsonb_agg(t) from ceaute.stripe_connect_event t),
     'storage_objects', (select jsonb_agg(o) from storage.objects o)
   );
   ```
   Store the file outside the repository (it contains emails and phone numbers).
2. **Storage:** download the one `portfolio-images` object with a service-role
   script (`storage.from('portfolio-images').download(path)`) into the same
   backup folder.
3. **Stripe:** nothing to back up; Stripe keeps every object. Note the ids in
   §1.3 in the backup folder.

### 3.4 Decide the Stripe outcome for the paid booking (see §4 A)

If the answer is "refund", do it **before** the database reset through the
product flow (cancel the booking from `/account/bookings` as the customer, let
the refund webhook mark the operation `succeeded`, re-run §3.2), then continue.
Otherwise skip.

### 3.5 Delete application data (SQL editor, one transaction)

```sql
begin;

-- guard: refuse to run anywhere except the known dev project data set
do $$ begin
  if (select count(*) from auth.users) <> 2 then
    raise exception 'unexpected user count, aborting';
  end if;
end $$;

delete from ceaute.booking_refund_operation;
delete from ceaute.booking_email_outbox;
delete from ceaute.booking_review;
update ceaute.booking set confirming_payment_attempt_id = null;
delete from ceaute.booking_payment_attempt;
delete from ceaute.booking;
delete from ceaute.treatment_add_on_compatibility;
delete from ceaute.treatment_add_on;
delete from ceaute.treatment;
delete from ceaute.treatment_group;
delete from ceaute.portfolio_image;
delete from ceaute.provider_location;
delete from ceaute.provider_booking_setting;
delete from ceaute.provider_payment_account;
delete from ceaute.provider_page;          -- cascades availability_rule, blocked_date
delete from ceaute.profile;
-- optional, see §4 C: webhook idempotency ledgers
-- delete from ceaute.stripe_payment_event;
-- delete from ceaute.stripe_connect_event;

-- storage objects (metadata rows; the files are removed in 3.6)
delete from storage.objects where bucket_id in ('portfolio-images','treatment-images');

-- auth users (cascades identities, sessions, refresh tokens, mfa factors)
delete from auth.users;

-- verification before commit
select
  (select count(*) from auth.users)                as auth_users,
  (select count(*) from ceaute.profile)            as profiles,
  (select count(*) from ceaute.provider_page)      as pages,
  (select count(*) from ceaute.booking)            as bookings,
  (select count(*) from ceaute.discovery_category) as categories; -- expect 0,0,0,0,15

commit;   -- or rollback;
```

`delete from auth.users` in SQL is the atomic alternative to
`auth.admin.deleteUser()`; either is acceptable once `ceaute.profile` is
empty. The SQL form keeps the whole reset in one transaction.

### 3.6 Storage files

Deleting `storage.objects` rows leaves the underlying files in S3 as orphans.
Remove them properly with the service role **before** 3.5, or list and remove
from the Dashboard → Storage → `portfolio-images` → folder `cec362b0-…`.
Script equivalent: `storage.from('portfolio-images').remove([...paths])` for
every path listed by `storage.from('portfolio-images').list()`. Keep the two
bucket definitions.

### 3.7 Stripe test objects

- **PaymentIntent, Charge, Transfer, Checkout Session, Events:** cannot be
  deleted in Stripe. Leave them. After the reset nothing references them; the
  next Checkout uses new idempotency keys (`ceaute-checkout-<new attempt id>`),
  so no collision is possible.
- **Connected account `acct_1UG6mOAQCiichWVj`:** either leave it orphaned
  (the Connect route marks its events `ignored`) or delete it in test mode
  with `DELETE /v1/accounts/acct_…` (works only when its balance is zero; the
  £15 transfer may still be pending payout). Deleting is optional, see §4 B.
- **Webhook destinations, signing secrets, platform account, API keys:** keep.
- Do **not** use the Dashboard "Delete all test data" button unless you have
  confirmed it keeps webhook endpoints; it is broader than this plan needs.

### 3.8 Unfreeze and verify

1. Re-enable both Stripe destinations; `update cron.job set active = true where jobname like 'ceaute-%';`
2. Verification queries (SQL editor):
   ```sql
   select (select count(*) from auth.users), (select count(*) from ceaute.profile),
          (select count(*) from ceaute.provider_page), (select count(*) from ceaute.booking),
          (select count(*) from ceaute.booking_payment_attempt),
          (select count(*) from storage.objects),
          (select count(*) from ceaute.discovery_category),   -- 15
          (select count(*) from storage.buckets),              -- 2
          (select count(*) from cron.job where jobname like 'ceaute-%' and active); -- 3
   ```
3. Functional check on ceaute.com: sign up with a fresh email, confirm the
   magic link, create a provider page, start Stripe onboarding (creates a new
   `acct_…`), publish, book and pay with `4242 4242 4242 4242`, and confirm the
   webhook produces a `confirmed` booking plus two `sent` emails.
4. Stripe Dashboard → Webhooks: both destinations show recent 2xx deliveries.

## 4. Decisions and uncertainties needing approval

| # | Decision | Recommendation |
| --- | --- | --- |
| A | Refund the £15 test payment before deleting its booking, or delete the booking and leave the PaymentIntent/Transfer as orphaned test objects? | Leave it; test money, no webhook side-effects. Refund only if you want the Stripe test ledger tidy. |
| B | Delete connected account `acct_1UG6mOAQCiichWVj` in Stripe, or leave it orphaned? | Delete if the API allows it (zero balance); otherwise leave. Its future events are ignored by design. |
| C | Truncate the `stripe_payment_event` / `stripe_connect_event` ledgers? | Keep them. They only record already-delivered event ids and protect against replays. |
| D | Delete **both** auth users including `ndu.harry02@gmail.com`, so the fresh signup is genuinely new? | Yes, that is what "completely fresh signup" implies; confirm. |
| E | Backup method: JSON export via SQL editor (only option without Docker/pg_dump). | Acceptable for two test users; confirm you do not need a restorable `pg_dump`. |
| F | Identity confirmation of the Vercel production env var (`NEXT_PUBLIC_SUPABASE_URL`). | I could not read Vercel (CLI token expired). Please check the dashboard once. |
| G | The `cron.job` `active` flag is the pause mechanism; if the Dashboard does not allow updates to `cron.job`, fall back to `cron.unschedule` + re-running the `cron.schedule` calls from migrations `202609150001` and `202609170002`. | Try `active = false` first. |

Destructive steps requiring explicit go-ahead: 3.5 (all deletes, including
`auth.users`), 3.6 (storage files), and 3.7 connected-account deletion.

## 5. Rollback

- Before `commit` in 3.5, `rollback;` restores everything instantly.
- After commit, the JSON backup from 3.3 contains every row, including
  `auth.users` and `auth.identities`, and can be re-inserted with
  `insert into … select * from jsonb_populate_recordset(null::ceaute.<table>, …)`
  in reverse deletion order; the storage file is re-uploaded to its original
  path. Stripe objects were never deleted, so ids still resolve.
- Realistically the data is disposable, so the practical rollback is to run
  the fresh signup journey again.

## 6. What this branch changes in the repository

Only this report. No application code, migration or configuration changes are
needed for the reset. If a reusable reset script is wanted later, it belongs in
`scripts/` with the project-host guard from §1.1 and must never be reachable
from the deployed app.
