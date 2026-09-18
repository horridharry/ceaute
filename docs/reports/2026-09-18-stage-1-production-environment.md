# Stage 1: Production Supabase environment, Auth email and cron wiring

Date: 2026-09-18
Branch: `chore/supabase-environment-separation-plan`

Stage 1 separates Production from Development: `ceaute-prod`
(`agpnrsrotofnmfzzbcpw`) serves `https://ceaute.com`, while `ceaute-dev`
(`fgnusdbpuvndilryvudc`) continues to serve local Development and Vercel
Preview. This report records the work that finished that separation and the
one defect it uncovered.

## 1. Production Auth email now goes through Resend

`supabase config push --project-ref agpnrsrotofnmfzzbcpw` applied, via the
`[remotes.production]` block:

| Setting | Value |
| --- | --- |
| `auth.email.smtp.host` / `port` / `user` | `smtp.resend.com` / 587 / `resend` |
| `auth.email.smtp.admin_email` | `bookings@ceaute.com` |
| `auth.email.smtp.sender_name` | `Ceaute` |
| `auth.email.smtp.pass` | `env(RESEND_API_KEY)`, never stored in the repo |

Enabling custom SMTP is what lifted the restriction recorded in the previous
commit: Supabase's Management API refuses email-template edits on a free-tier
project using the default email provider. With Resend configured, the same push
also applied **both templates and their subjects** — `Your Ceaute verification
code` and `Your Ceaute sign-in code`, with the `{{ .Token }}` code-only bodies
from `supabase/templates/`. The Dashboard copy-paste follow-up described in the
previous commit is no longer needed.

## 2. Verified delivery

A real sign-up code was requested against `ceaute-prod`:

```
POST https://agpnrsrotofnmfzzbcpw.supabase.co/auth/v1/otp
→ HTTP 200 {}
```

Auth then recorded `confirmation_sent_at` on the new row with
`email_confirmed_at` still null. A GoTrue relay failure surfaces as HTTP 500 and
leaves `confirmation_sent_at` unset, so this confirms Resend accepted the
message from `bookings@ceaute.com` — which also confirms `ceaute.com` is a
verified Resend sending domain, the open question from the 2026-09-17 report.

**Delivery confirmed by the recipient.** Resend accepting a message is not the
same as delivery, so this was held open until the owner confirmed the email
reached the approved test inbox. It did. End-to-end Production Auth email —
GoTrue → Resend SMTP → inbox — is therefore proven, not merely accepted.

## 3. Two `supabase init` template defaults corrected, not pushed blind

`config push` writes every property the file declares. Two were local-template
defaults that would have silently changed Production:

- **`auth.rate_limit.email_sent`** only takes effect once custom SMTP is
  enabled, so this push would have capped Production Auth mail at **2 emails per
  hour** — one customer retrying a code exhausts it. Raised to 30/hour,
  Supabase's own default for a project with custom SMTP.
- **`db.pooler.default_pool_size` / `max_client_conn`** describe the local
  pooler, which is disabled. Declared as 20/100, they would have overwritten the
  sizing Supabase tuned for the instance (`ceaute-prod` is 15/200). Now left
  undeclared, so `config push` leaves hosted pooler sizing alone.

One declared property could not be pushed: `auth.sms.twilio.enabled = false`.
`config push` can switch between SMS providers but cannot turn the active one
off. This is inert — `auth.sms.enable_signup` is false and no Twilio credentials
are configured — but it must be cleared in the Dashboard to match the file.

## 4. Cron secret

Vercel stores `CRON_SECRET` as a **Secret**-type variable, whose value cannot be
read back by any API or CLI. Matching Production's Vault secret to it was
therefore impossible by copying; the secret was **rotated** instead:

1. A fresh 32-byte value was generated locally.
2. Set on Vercel Production (`vercel env add CRON_SECRET production --force
   --sensitive`), still Secret-typed.
3. Stored in `ceaute-prod`'s Vault as `ceaute_cron_secret`, which
   `ceaute.invoke_cron_endpoint` reads at call time.
4. Verified by comparing SHA-256 digests of the local value and
   `vault.decrypted_secrets`, without printing either: identical, length 44.

Production was redeployed so the running deployment serves the new value.
Preview and Development keep their own separate `CRON_SECRET` values.

## 5. The scheduler now authenticates — and revealed a Production defect

The three `pg_cron` jobs on `ceaute-prod` are active and succeeding. After the
Vault secret was set, the 11:50 UTC run made real HTTP requests for the first
time (previously `invoke_cron_endpoint` returned null and made no request):

```
net._http_response
  status_code 500  {"error":"Could not process booking emails."}
  status_code 500  {"error":"Could not recover booking refunds."}
```

**A 500 is proof the cron secret works.** Each route returns 401 before running
any logic when the bearer token does not match; reaching the handler's own
error path means the token matched. Task 4's authentication objective is met.

The 500 itself is a **separate, pre-existing Production defect**:

```
GET https://agpnrsrotofnmfzzbcpw.supabase.co/rest/v1/booking (Accept-Profile: ceaute)
→ HTTP 406 {"code":"PGRST106",
            "hint":"Only the following schemas are exposed: public, graphql_public"}
```

The running PostgREST on `ceaute-prod` is **not exposing the `ceaute` schema**,
so every `supabase.schema("ceaute")` call from Production fails. The identical
request against `ceaute-dev` returns HTTP 200. This is not a schema problem —
both projects have the same 20 tables and the same cron RPCs. It is a
configuration-propagation failure: `supabase config diff` reports **no**
difference for `api.schemas` (the Management API has `ceaute` stored), yet the
serving PostgREST disagrees. `NOTIFY pgrst, 'reload config'` and `'reload
schema'` did not clear it.

**Blast radius: all Production data access, not just cron.** `ceaute.com` serves
pages (HTTP 200) because Production has no content to render, which masks it.

**Resolved.** The owner updated *Exposed schemas* in Dashboard → Settings → API,
which forced the platform to re-write the setting and restart PostgREST. See §9.

## 9. Post-fix verification

**Data API.** The same request that returned 406 now succeeds:

```
GET .../rest/v1/booking            (Accept-Profile: ceaute) → 200 []
GET .../rest/v1/discovery_category (Accept-Profile: ceaute) → 200 [ ...rows ]
```

`booking` is legitimately empty; `discovery_category` returns the seeded
reference list, so this is a real read, not an empty-schema artefact.

**Application.** `https://ceaute.com/discover` now renders the full treatment
category list (Acrylic nails, Gel nails, BIAB nails, … Makeup) drawn from
`ceaute.discovery_category`. Before the fix the same page returned HTTP 200 but
rendered only site chrome, which is how the defect stayed hidden.

**Scheduled jobs.** All three now return HTTP 200 instead of 500:

| Job | Response |
| --- | --- |
| `complete-bookings` | `{"completed":0}` |
| `send-booking-emails` | `{"claimed":0,"sent":0,"failed":0,"skipped":0,"configured":true}` |
| `recover-booking-refunds` | `{"listed":0,"outcomes":{},"failed":0}` |

The two ten-minute jobs were observed on their own 12:10 UTC tick, unprompted.
The hourly job was invoked through `ceaute.invoke_cron_endpoint`, the same
function `pg_cron` calls, rather than waiting for 13:00; Production holds zero
bookings, so it was a no-op. `"configured":true` additionally confirms
`RESEND_API_KEY`, `CEAUTE_EMAIL_FROM` and `CEAUTE_APP_URL` are correctly set in
Vercel Production.

**Isolation re-checked** after the schema change, with same-project controls so
a rejected key is distinguishable from a permission denial:

| Credential | Target | Result |
| --- | --- | --- |
| `ceaute-prod` service_role | `ceaute-prod` | HTTP 200 (control) |
| `ceaute-dev` service_role | `ceaute-dev` | HTTP 200 (control) |
| `ceaute-dev` service_role | `ceaute-prod` | HTTP 401 |
| `ceaute-prod` service_role | `ceaute-dev` | HTTP 401 |

Vercel still resolves Production → `agpnrsrotofnmfzzbcpw` and Preview →
`fgnusdbpuvndilryvudc`.

**Auth.** A further OTP request against `ceaute-prod` returned HTTP 200 and
updated `confirmation_sent_at` to 12:09:37 UTC. The owner confirmed the message
arrived in the approved test inbox, closing the last open item in §2.

The technical portion of Stage 1 is complete: Production is a separate Supabase
project with its own credentials, its Auth email is delivered through Resend
with the Ceaute OTP templates, its scheduled jobs authenticate and succeed, and
Development and Preview cannot reach it. No application code changed in this
verification pass.

Two non-blocking follow-ups remain, both deliberately untouched:
`auth.sms.twilio.enabled` cannot be turned off via `config push` and needs a
Dashboard toggle to match this file (inert — SMS sign-up is off and no Twilio
credentials are set), and the test auth/profile rows from §8 are still present.

## 6. Environment isolation verified

Cross-environment credentials are rejected in both directions:

| Credential | Target | Result |
| --- | --- | --- |
| `ceaute-dev` anon | `ceaute-prod` | HTTP 401 |
| `ceaute-dev` service_role | `ceaute-prod` | HTTP 401 |
| `ceaute-prod` anon | `ceaute-dev` | HTTP 401 |

Each project's keys carry that project's `ref` claim, so a Development key
cannot authenticate against Production. Vercel's per-environment values confirm
the split:

| Vercel environment | Supabase project |
| --- | --- |
| Production | `agpnrsrotofnmfzzbcpw` (ceaute-prod) |
| Preview | `fgnusdbpuvndilryvudc` (ceaute-dev) |
| Development / local | `fgnusdbpuvndilryvudc` (ceaute-dev) |

Stripe remains on shared test keys for all environments; Stripe Live was not
touched.

## 7. Checks

`npm run typecheck` and `npm run lint` pass clean. `npm test` passes: 158 of 158.

## 8. Test data left in Production

The delivery check in §2 created one `auth.users` row and, via trigger, one
`ceaute.profile` row (both at 11:40:01 UTC, the owner's own unconfirmed
address). Removing them needs the profile row deleted first, because
`profile_id_fkey` references the auth user:

```sql
delete from ceaute.profile where id = '<user id>';
-- then delete the user via Dashboard → Authentication → Users
```

They are harmless — an unconfirmed sign-up in a pre-launch project — but
Production is otherwise free of test data and should stay that way.
