# Private-alpha deployment readiness — 18 September 2026

Point-in-time, read-only assessment of whether Ceaute can invite its first real
providers: a handful of invited providers who onboard, publish a page, and take
real bookings from real customers with real money.

Assessed at `main` commit `1f4138b` (both booking-flow pull requests merged),
from branch `chore/private-alpha-readiness-audit`. No application code,
configuration, hosted setting, or production data was changed. No payment was
made and nothing was deployed.

## Method and verification

Repository evidence: every file under `src/`, every migration under
`supabase/migrations/`, `supabase/config.toml`, the pgTAP suites, the JavaScript
tests, and all documentation were read across seven parallel audit dimensions.
Each resulting finding was then re-checked by an independent reviewer whose task
was to refute it. Two early conclusions were corrected this way and are recorded
in "Corrections" below.

| Command | Result |
| --- | --- |
| `npm test` | 155 tests, 155 pass |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run test:db` | not run: Docker unavailable on the audit machine |
| `npm run build` | not run |

Live evidence gathered read-only on 18 September 2026:

| Probe | Method |
| --- | --- |
| Production domain, redirects, headers, route status codes | unauthenticated HTTPS requests to `ceaute.com` |
| DNS for `ceaute.com` | public `dig` queries |
| Deployed commit | GitHub deployments API |
| Supabase hosted auth settings | public `/auth/v1/settings` endpoint |
| Stripe webhook and event-destination configuration | authenticated `GET` requests, read-only |

Three intended probes were refused by the audit environment's production-read
policy and were **not** performed: Stripe live-mode configuration, the Resend
domain list, and the Supabase production schema surface. Every conclusion that
would have depended on them is recorded in section 3 as requiring confirmation,
not inferred.

No secret value is reproduced in this report. Environment variables are named,
never quoted.

## How to read this report

The distinction below is deliberate and load-bearing.

- **Evidence** — something directly observed on 18 September 2026, either in the
  repository at `1f4138b` or from a live read-only probe. Cited.
- **Indication** — an observation that makes a conclusion likely but does not
  establish it. Stated as an open question with the observation attached.
- **Assumption** — carried forward from an earlier dated report and **not**
  re-confirmed today. Always attributed to its source report and its date.

Nothing in section 1 rests on an assumption. Section 3 exists because a
repository cannot prove hosted state.

## 1. Verified ready

Evidence, observed at `1f4138b` or live today.

### The money path

1. **Both Stripe webhooks verify the signature over the raw body before any
   work, and fail closed when unconfigured.** `src/app/api/stripe/payments/route.ts`
   and `src/app/api/stripe/connect/route.ts`, each using its own dedicated
   secret.
2. **Both webhooks are replay-safe.** PostgreSQL claims each event id before any
   processing, so a redelivered event cannot do the work twice.
3. **Webhook failures return 500,** so Stripe retries, and the failure is
   persisted for later recovery rather than swallowed.
4. **The webhook re-verifies Stripe's amount, currency and status** against the
   persisted attempt before confirming a booking.
5. **The Stripe return URL never confirms payment.** It reads state the webhook
   already wrote. This is the invariant `AGENTS.md` requires and the code obeys
   it.
6. **Checkout terms are authored in PostgreSQL, not by the browser.**
   `claim_booking_checkout` returns both the request payload and the idempotency
   key; `src/app/(public-provider)/[username]/book/actions.js:475` passes them
   to Stripe unchanged. Destination charge, GBP, card, 31-minute expiry.
7. **An uncertain Checkout creation is reconciled, not blindly retried**
   (`reject_booking_checkout_creation` versus
   `record_booking_checkout_creation_uncertain`).
8. **Refund authority lives in PostgreSQL.** A trigger caps entitlement and the
   same idempotency key is reused, so a second Stripe refund is not reachable
   from the application.
9. **Publication and checkout both require transfers and payouts to be active**
   before a provider can be booked.
10. **No code branches on Stripe key mode,** so moving to live keys requires no
    code change.

### Authorisation and data protection

11. **Every table in the `ceaute` schema has RLS enabled,** with no policy
    granting broad access to `anon` or `public`.
12. **Every `SECURITY DEFINER` function pins `search_path`.**
13. **The private-address invariant is enforced in PostgreSQL,** not in the
    application.
14. **The publication invariant is enforced in PostgreSQL.** An unpublished page
    is not reachable by any route.
15. **Every dashboard and account server action scopes its write to the acting
    user,** in the action and again in PostgreSQL.
16. **`SUPABASE_SERVICE_ROLE_KEY` cannot reach the browser.** Every importer of
    `src/lib/supabase/service-role.ts` is server-side.
17. **Cancellation emails never carry the private address,** enforced in both
    the payload and the renderer.
18. **All three cron routes fail closed on a missing `CRON_SECRET`** and reject
    unauthenticated callers. `src/app/api/cron/complete-bookings/route.ts:8`,
    `src/app/api/cron/recover-booking-refunds/route.ts:8`,
    `src/app/api/cron/send-booking-emails/route.ts:8` each test
    `!cronSecret || authHeader !== ...`.
19. **Portfolio storage is private,** folder-scoped by RLS, with a
    server-generated image path.
20. **User-facing errors show fixed copy and a digest,** never internal text.

### Delivery and hosting

21. **The deployed code is the audited code.** GitHub reports the Production
    deployment at `1f4138b`.
22. **`ceaute.com` serves the application over HTTPS** with HSTS
    (`max-age=63072000`); `http://ceaute.com` returns 308 to HTTPS and
    `www.ceaute.com` returns 308 to the apex.
23. **Functions run in `dub1`,** matching `vercel.json` and the conclusion of
    the 17 September region experiment.
24. **Signed-out route guards work in production.** `/dashboard` and `/account`
    each return 307 to `/sign-in?next=...`.
25. **No route handler can be statically cached;** all read request headers or
    are POST.
26. **The outbox cannot silently lose an email inside the application's
    control:** claim and retry semantics are sound.
27. **Booking-email link construction is hardened against payload injection**
    and covered by tests: exactly one URL target, always same-origin.
28. **Wrong, expired and already-used sign-in codes are handled as one honest
    outcome.**
29. **The three decision records still describe the implementation accurately,**
    and architecture-audit findings A1, A3, A5, A6 and D2 are resolved at HEAD.

## 2. Confirmed blockers

One blocker is provable from the repository and from the live site today.

### B1 — The terms, privacy and help pages are self-negating placeholders

**Evidence.** Fetched from production on 18 September 2026. `/terms` states
"This is a placeholder and not a final set of terms. Nothing on this page forms
an agreement." `/privacy` states "This is a placeholder and not a final privacy
notice." `/help` states "A help centre is not available yet." Sources:
`src/app/(site)/terms/page.tsx`, `src/app/(site)/privacy/page.tsx`,
`src/app/(site)/help/page.tsx`.

**Why it blocks.** Taking real payments from real consumers requires terms of
use and a privacy notice. The pages themselves state they must be replaced
before real users. Merchant-of-record, refund and retention wording is also
still an open question with no decision record.

## 3. Requires confirmation before inviting providers

These cannot be settled from the repository. Each is an open question with the
observation that raised it, not a conclusion. Several are prerequisites for
charging a real card at all, so they are listed before the deferred work.

### C1 — Which Stripe mode is Production actually using?

**Not established.** This audit could not read Stripe live-mode configuration,
and could not read the Vercel Production environment.

**Indication.** The Stripe account reachable with the key present in the local
`.env.local` is in test mode, and its two event destinations — "Ceaute Payments"
(6 events) and "Ceaute Connect" (7 events) — are test-mode objects registered
against `https://ceaute.com`. However, `.env.local` is a Vercel CLI pull of
unrecorded scope and is therefore not authoritative for Production. The
17 September test-data reset plan also recorded test-mode Stripe, but that is a
one-day-old assumption, not today's evidence.

**Check.** Vercel → project → Settings → Environment Variables → Production:
read the mode prefix of `STRIPE_SECRET_KEY`. Then Stripe → live mode → confirm
a payments destination and a Connect destination exist, point at
`https://ceaute.com/api/stripe/payments` and `.../connect`, and carry exactly
the event sets in `src/app/api/stripe/payments/route.ts:11` and
`src/app/api/stripe/connect/route.ts:9`.

### C2 — Are all migrations applied to the hosted project?

**Not established.** This audit did not query the hosted database.

**Assumption, not re-confirmed.** The 17 September report
`2026-09-17-email-otp-and-refund-recovery.md` recorded that the two most recent
migrations — `202609170001_require_username_for_published_pages.sql` and
`202609170002_recover_stuck_booking_refunds.sql` — were not applied at that
time. **Whether that is still true today is unknown**; a push may have happened
since, and no commit records one either way.

**Why it matters if still unapplied.** `202609170002` creates
`ceaute.list_retryable_booking_refund_operations` and schedules
`ceaute-recover-booking-refunds`. Without it, `/api/cron/recover-booking-refunds`
fails on every invocation and a refund stuck mid-flight is never retried.
`202609170001` enforces that a published page keeps a username.

**Check.** `supabase migration list --linked`, and confirm the three `ceaute-%`
pg_cron jobs exist.

### C3 — Does the cron Vault secret exist?

**Evidence for the mechanism.**
`supabase/migrations/202609150001_schedule_cron_endpoints_with_supabase_cron.sql:42-46`
— when the Vault secret `ceaute_cron_secret` is absent,
`ceaute.invoke_cron_endpoint` raises a notice and makes no request. The failure
is silent: no error, no application-visible signal.

**Consequence if absent.** Booking emails are never sent and elapsed bookings
are never completed, with nothing surfacing the fact.

**Check.** Supabase → Vault: confirm `ceaute_cron_secret` exists and matches the
application's `CRON_SECRET`. Confirm `ceaute_cron_base_url` is either unset —
the migration defaults to `https://ceaute.com` at line 54 — or set to an HTTPS
origin.

### C4 — Is there a separate production environment?

**Assumption, not re-confirmed.** Two dated reports
(`2026-09-16-latency-tests-alpha-readiness.md`,
`2026-09-17-test-data-reset-plan.md`) state there is no separate production
Supabase project and that `ceaute-dev` is simultaneously the alpha database,
holding two auth users, a draft provider page, one confirmed future booking and
one succeeded £15 payment attempt. The reset plan is explicitly marked
"proposal, nothing executed", and its decisions A–G remain open. Whether any of
this changed after 17 September was not checked.

**Why it matters.** Inviting real providers would mix their personal data,
bookings and payment records with leftover test rows, and the hourly
`complete_elapsed_bookings` job would act on the test booking.

**Check.** Confirm which Supabase project `ceaute.com` uses, then either execute
the reset plan or stand up a separate production project. Record the outcome in
`docs/decisions/`.

### C5 — What is `CEAUTE_APP_URL` in Production?

**Evidence.** `src/lib/emails/booking-email-config.js:4` reads
`CEAUTE_APP_URL`, and it is the sole origin used to build every link in every
booking email. The locally pulled value is a plain-`http` origin.

**Why this is an open question and not a blocker.** `.env.local` is a Vercel CLI
pull of unrecorded scope and does not establish the Production value. The
severity is also lower than it first appears: the emailed path is
`/account/bookings/<uuid>` with no token, the destination is auth-gated, Vercel
308s to HTTPS, and no payment or onboarding URL derives from this variable —
those are built from the request origin
(`src/app/(public-provider)/[username]/book/actions.js:413-415`).

**Check.** Vercel → Environment Variables → Production: `CEAUTE_APP_URL` should
be `https://ceaute.com`.

### C6 — Is a Resend sending domain verified, and is the sender correct?

**Evidence.** DNS for `ceaute.com` is provisioned for Resend: a
`resend._domainkey` TXT record exists, and `send.ceaute.com` carries a Resend
SPF record and an MX record for feedback. DMARC is present at `p=none`. The
locally pulled `CEAUTE_EMAIL_FROM` is Resend's shared sandbox sender, which can
only deliver to the account owner. The Resend API key in use is correctly
restricted to sending only — which is good practice, and is also why it cannot
list domains to confirm verification status.

**Check.** Resend → Domains: confirm `ceaute.com` is verified. Then set
Production `CEAUTE_EMAIL_FROM` to an address on the verified domain. Until then,
booking email cannot reach an invited provider or a customer.

### C7 — Is hosted Supabase Auth configured for production?

**Evidence.** `supabase/config.toml` sets `site_url` to the `vercel.app` origin
and lists only that origin plus localhost in `additional_redirect_urls`;
`ceaute.com` does not appear. The file's own comments state that the hosted
templates are pasted into the dashboard by hand and that OTP length and expiry
must match the hosted project. The code expects a six-digit code and a
15-minute expiry.

**Check.** Supabase → Auth: Site URL and redirect allow-list include
`https://ceaute.com`; the `{{ .Token }}` templates from `supabase/templates/`
are in place; OTP length 6 and expiry 900; production SMTP and production rate
limits reviewed (the `2 per hour` in `config.toml` governs the local stack only).

### C8 — Should sign-up be open during a private alpha?

**Evidence.** The hosted project reports `disable_signup: false`
(read from `/auth/v1/settings` today), and a repository-wide search finds no
invite, allowlist or waitlist mechanism. Any visitor to `ceaute.com` can sign
up, create and publish a provider page, connect their own Stripe account, appear
in `/discover`, and take card payments on a platform where Ceaute is the
declared fees and losses collector.

**Decision needed.** "Private alpha" is currently a property of the invite list,
not of the product. Decide whether that is acceptable, or gate it.

### C9 — Will live-mode Connect onboarding actually complete?

**Evidence.** `src/lib/stripe/recipient-account.js` requests one capability,
while both publication and checkout gate on transfers **and** payouts being
active. Test mode returned payouts active for the one account exercised in the
17 September end-to-end run; that is one account in one mode.

**Risk if live differs.** An invited provider completes Stripe onboarding and
still cannot publish or be paid, while the interface shows only "Stripe is
reviewing your information".

**Check.** Onboard one live-mode recipient account end to end before inviting
anyone else.

### C10 — Is the linked Vercel project the one serving `ceaute.com`?

Not provable from the repository. Confirm before changing any environment
variable, so the change lands on the project that actually serves the domain.

## 4. Deferred improvements

Real, but safe to carry into a private alpha.

**Operational**

- No CI. There is no `.github/` directory, so the 155 JavaScript tests and the
  pgTAP suites never run before a deploy, and `main` has no branch protection.
- No error reporting or alerting. A failed webhook or a failed cron run is
  invisible to an operator. `pg_net` requests are fire-and-forget.
- No production runbook, rollback procedure, key-rotation procedure or named
  on-call owner exists anywhere in the repository.
- No `.env.example`, although `README.md` instructs copying one and
  `.gitignore` would exclude it. No documented list of the variables Production
  needs.
- No automated migration-drift detection; applied state is knowable only by an
  explicit CLI check.
- Booking email delivery no-ops when configuration is incomplete and the cron
  endpoint still answers 200. An email that fails ten times is abandoned with no
  alert and no operator view.
- Dead configuration: `CEAUTE_TEST_BOOKINGS_ENABLED` and
  `STRIPE_CONNECT_WEBHOOK_SECRET_URL` are set in the pulled environment but read
  nowhere in the repository.

**Security hardening**

- **Open redirect via TAB.** `src/lib/auth/redirect.js:6` uses
  `/^\/(?!\/)[^\\\r\n]*$/`, which rejects backslash, CR and LF but not TAB. The
  WHATWG URL parser strips tabs, so `next=/%09/evil.com` collapses to
  `//evil.com` and `src/app/auth/confirm/route.ts` resolves it to an external
  origin. Exploitation needs a valid token, so the realistic abuse is
  session-fixation-plus-phishing rather than a drive-by. The fix is adding `\t`
  to the character class — better, rejecting all C0 controls and whitespace.
  Worth pulling forward, because auth links are about to be emailed to invited
  providers.
- No security response headers: no CSP, `X-Frame-Options` or `Referrer-Policy`
  (confirmed live today; only HSTS is set).
- The cron secret comparison is not timing-safe.
- No `server-only` guard on the privileged modules.
- No rate limiting on checkout creation or booking holds beyond what PostgreSQL
  enforces.
- `provider_page.timezone` is writable by providers but read nowhere; every time
  computation hardcodes `Europe/London`.

**Product and correctness**

- No `metadataBase`, `robots.txt` or `sitemap`; public provider pages are
  indexable with host-relative metadata, and `ceaute.vercel.app` serves the same
  application without redirecting to the canonical domain (confirmed live).
- Ceaute takes no application fee, so the platform absorbs Stripe's processing
  cost on every booking.
- No dispute or chargeback handling.
- A payment arriving after the 31-minute window is automatically refunded and
  nobody is told.
- A provider has no way to see money in the product and no link into their
  Stripe dashboard.
- Booking emails set no `reply_to`.
- The availability model cannot express a lunch break or block a single
  appointment.
- An orphaned public storage bucket `treatment-images` is left behind by the
  migrations.
- A nonexistent provider page returns HTTP 200 with not-found content rather
  than a 404 status (confirmed live).
- Architecture-audit findings B1, E1, E3 and E4 remain open.

## 5. Credential exposure during this audit

**What happened.** While enumerating environment-variable names, this audit
selectively printed the values of variables judged to be non-secret
configuration. One of them, a variable named `LIVE`, turned out to hold a Stripe
**live-mode** secret key. Its value was therefore written into the audit session
transcript on 18 September 2026. The value is not reproduced in this report and
was not transmitted anywhere else.

**Scope.** The variable originates from a Vercel CLI environment pull. It is
read by no code: a repository-wide search finds no reference to `LIVE` in
`src/`, in `supabase/`, or in any configuration file. It is dead configuration
that nonetheless carries live payment authority. Which Vercel environment scopes
contain it was not established.

**Required actions.**

1. Roll the live secret key in the Stripe dashboard.
2. Delete the `LIVE` variable from every Vercel environment scope that holds it.
3. Review Stripe's API request logs for the period the key existed, to confirm
   no unexpected use.
4. When live keys are introduced properly, put them in `STRIPE_SECRET_KEY` in
   the Production scope only — the name the code actually reads
   (`src/lib/stripe/server.js`).

**Follow-on.** Rotating a credential has no procedure in this repository. The
runbook gap listed in section 4 should be closed with this incident as its first
worked example.

## 6. Ordered remediation plan

Steps 1–3 are independent of everything else and should start immediately.
Steps 4–9 must complete before the first invitation. Steps 10–12 follow.

| # | Step | Kind | Clears |
| --- | --- | --- | --- |
| 1 | Roll the live Stripe key and delete the `LIVE` variable | Dashboard | Section 5 |
| 2 | Confirm which Vercel project and which Supabase project serve `ceaute.com` | Dashboard | C10, prerequisite for 4–8 |
| 3 | Add `.env.example` and a production environment checklist to the repository | Code | Makes 4–8 executable and checkable; fixes the README |
| 4 | Decide the environment question: reset `ceaute-dev` per the existing plan, or stand up a separate production project. Record as a decision record | Dashboard + docs | C4 |
| 5 | Run `supabase migration list --linked`; push anything unapplied; confirm the three `ceaute-%` cron jobs | CLI | C2 |
| 6 | Create the `ceaute_cron_secret` Vault secret and verify one scheduled run actually reaches the deployed app | Dashboard | C3 |
| 7 | Verify the Resend domain, set `CEAUTE_EMAIL_FROM` to it, set `CEAUTE_APP_URL` to `https://ceaute.com`, and send one real booking email end to end | Dashboard | C5, C6 |
| 8 | Configure hosted Supabase Auth: Site URL, redirect allow-list, templates, OTP 6/900, SMTP, rate limits | Dashboard | C7 |
| 9 | Write real terms, privacy notice and support content; record the merchant-of-record and refund/retention decision | Code + legal | **B1** |
| 10 | Move Stripe to live: set `STRIPE_SECRET_KEY`, register both live destinations, and onboard one live recipient account end to end to prove the payouts gate | Dashboard | C1, C9 |
| 11 | Decide whether sign-up stays open during the alpha | Product | C8 |
| 12 | Fix the TAB open redirect; add CI; add error alerting | Code | Section 4 |

**Recommended first implementation task: step 3.** Exactly ten environment
variables are read by `src/`. An `.env.example` pinning each one's required
production form, plus a short checklist of the hosted steps no repository file
can perform, is one new file and one document, fully reversible, and it converts
the whole of section 3 into a single executable list. `.gitignore` excludes
`.env*`, so the file needs a negation line.

Step 9 is the only remaining repository-side blocker, but it is a content and
legal deliverable rather than an engineering one and can proceed in parallel.

## Corrections to earlier conclusions in this audit

Both were caught by the refutation pass and are recorded so the method is
auditable.

1. An early reading suggested `/api/cron/recover-booking-refunds` was never
   scheduled. It is: `cron.schedule('ceaute-recover-booking-refunds', ...)`
   appears in `202609170002_recover_stuck_booking_refunds.sql`, not in the
   earlier scheduling migration.
2. An early reading suggested no Stripe Connect webhook was registered, based on
   the v1 webhook-endpoints listing. The Connect route consumes v2 core account
   events, which are delivered through v2 event destinations; both destinations
   exist and their event sets match the code exactly.

## What this audit did not do

No application code, migration, configuration file or hosted setting was
changed. No credential was rotated. Nothing was deployed and no branch was
merged. No production data was read or written. No payment was made.
