# Latency, test coverage and private-alpha readiness — 16 September 2026

Work was done on branch `perf/navigation-latency` (uncommitted, not merged, not
deployed). Nothing external was changed. Docker is unavailable on this machine,
so `npm run test:db` could not be run; every other verification command passed.

## 1. Performance

### Where the time goes (evidence)

| Measurement | Result |
| --- | --- |
| `X-Vercel-Id` on every ceaute.com response | `lhr1::iad1::…` — edge in London, function in Washington DC |
| Supabase project region (`supabase/.temp/pooler-url`) | `aws-1-eu-west-1` (Ireland); project name `ceaute-dev` |
| JWT signing (`/auth/v1/.well-known/jwks.json`) | ES256 — `getClaims()` verifies locally, JWKS cached per process |
| One `provider_page` lookup, London → Ireland | median 66 ms |
| `/discover?category=gel-nails`, same build, local server from London | 85–100 ms total |
| `/discover?category=gel-nails`, deployed | 530–550 ms total; 1.5 s on a cold function |
| `/@unknown` (one query then not-found), local vs deployed | 60–90 ms vs 340–960 ms |
| `/dashboard` unauthenticated redirect (proxy only, runs at the edge) | ~90–100 ms |

Conclusion: roughly 450 ms of every deployed page is the London → iad1 → Ireland
network path, not application code. Each database query made from the
function costs about 150–170 ms instead of about 65 ms, and an authenticated
dashboard page makes three to four of them in sequence.

### Per-navigation execution path (before → after)

Every route in the build is dynamic because the root layout header reads
cookies, so a soft navigation always makes one function round trip plus the
page's own queries.

| Path | Before | After |
| --- | --- | --- |
| dashboard → treatments | proxy claims + page lookup (edge) → function: claims → provider_page → treatments → [categories ∥ groups] (3 sequential DB hops) | provider_page → [treatments ∥ categories ∥ groups] (2 hops). Measured chain: 207 ms → 171 ms from London; ~85 ms saved from iad1 |
| dashboard → availability | two helpers each did claims + provider_page in parallel, then their query (4 requests) | one claims check + one provider_page, then [rules ∥ blocked dates] (3 requests). 142 ms → 131 ms |
| dashboard → bookings | client component rendered an empty shell, then `useEffect` called a server action: a second full request through proxy + function + claims + provider_page + RPC + attempts | server component, one request; `loading.jsx` already provides the pending state. Removes one complete client→edge→iad1 round trip (~300–400 ms) |
| dashboard → settings | claims + provider_page (guard only) | unchanged; one hop is the minimum |
| provider page → treatment → time → checkout | choosing a slot awaited a server action that wrote a cookie nobody reads, then navigated | navigation only; the start time already travels in the URL. Removes one action round trip (~250–400 ms) per slot selection |
| public provider page, discover, portfolio | one Storage request per image to sign URLs | one batched `createSignedUrls` request |
| any full page load (header + page) | header and page each ran `getClaims` + `provider_page` | shared per-request via React `cache()`; one of each |
| account → settings | an unused `provider_page` query (lint warning) | removed |

### What was deliberately not changed

- **Function region (recommended, highest impact).** Set the Vercel project's
  function region to `dub1` (Dublin, same AWS region as Supabase) or `lhr1`.
  Equivalent config: `vercel.json` with `{ "regions": ["dub1"] }`. Expected
  effect: per-query cost falls from ~160 ms to ~10–20 ms, and the
  edge→function hop from ~150 ms to a few ms. This is an infrastructure
  setting, so it is left for you.
- **Proxy provider-page lookup.** The proxy repeats the page's own lookup, but
  it runs at the London edge (~25 ms) and is documented behaviour; not worth
  the architectural change.
- **Cold starts.** First hit after idle adds ~1 s (function boot + JWKS fetch).
  Only region placement and traffic mitigate this; no code change is safe.
- **Booking summaries** run the RPC then the payment-attempt query; the second
  needs the first's IDs. Folding it into the RPC is a database change and not
  worth it before the region move.
- **Cache Components / `use cache`.** Not adopted; nothing here should be
  cached across users, and freshness rules would be at risk.

## 2. Test coverage

See section "MVP coverage matrix" below and the new tests listed in section 4.
The database inventory was produced by reading every migration and every pgTAP
file; the matrix marks a behaviour "strong" only when an existing test
exercises the final version of the function or constraint.

### MVP coverage matrix

| Behaviour | Status | Notes |
| --- | --- | --- |
| Provider onboarding | Partial | one-page-per-profile uniqueness and policy names tested; `create_provider_page_draft` never called in tests |
| Provider-page editing | Partial | column grants (status, booking_window_days denied) tested; no cross-tenant update test |
| Duplicate usernames | Untested → **added (DB)** | unique index + format check in new pgTAP file |
| Locations / address privacy | Strong | redaction in summaries, hold summary and email payloads tested |
| Treatments | Partial → **added (DB)** | fixtures only before; cross-tenant RLS added |
| Treatment groups | Untested → **added (DB)** | cross-tenant RLS added |
| Add-ons and compatibility | Strong | atomic create/update, cross-provider rejection |
| Availability | Partial | 15-minute grid strong; one-period-per-weekday constraint and blocked-date uniqueness untested |
| Publication | Partial | ready page publishes, suspended rejected; incomplete-requirements failure untested |
| Discovery | Untested → **added (DB)** | published-only filtering in new pgTAP file |
| Booking holds | Strong | notice, window, grid, hours, blocked, overlap exclusion |
| Booking creation (snapshots) | Partial | address keys reach email payloads; money fields in snapshots not asserted |
| Full-payment booking | Strong | claim, persist, confirm, replay |
| Deposit booking | Strong | 1000/5000 split, due-later, confirm |
| Stripe payment confirmation | Strong | session/amount mismatch, replay, duplicate, late payment |
| Webhook replay / idempotency | Strong (DB) | claim/fail/retry/complete for payment and Connect events; route handlers themselves only manually tested |
| Provider / customer booking views | Strong | redaction per state; list scoping across users not asserted |
| Cancellation | Partial → **added (DB + JS)** | authorisation strong; late-window retention and completed-booking rejection added in DB; customer-facing amounts added in JS |
| Refunds | Strong (DB) → **added (JS)** | operation lifecycle strong; Stripe-side processing (create once, retrieve existing, definitive vs unknown failure, reconciliation) now unit-tested |
| Automatic completion | Untested → **added (DB)** | `complete_elapsed_bookings` |
| Email outbox | Strong (DB) → **added (JS)** | claim/retry/cap strong; delivery loop, idempotency key, privacy of content now unit-tested |
| Reviews | Untested → **added (DB)** | one per completed booking, rating range, owner cannot review |
| Public / draft / suspended visibility | Strong | all `get_public_*` projections |
| Authorization / RLS | Partial → **added (DB)** | denials on booking/payment strong; cross-tenant reads/inserts on provider-owned tables added |
| Duplicate submissions / concurrency | Strong | exclusion constraint, `processing` claims, idempotent refund upsert |

Only manually tested (no automation possible without a browser harness or
live Stripe): Stripe Connect hosted onboarding, Checkout redirect, the webhook
HTTP handlers' signature verification, magic-link sign-in, portfolio upload.

### New database test file (not run here)

`supabase/tests/database/mvp_alpha_regressions.test.sql`, plan 46, written in
the existing fixture/impersonation style and checked by reading against the
final function definitions:

- usernames: duplicate rejected by `provider_page_username_unique`; malformed
  and upper-case names rejected by `provider_page_username_format`;
- reviews: anon cannot execute; confirmed-but-not-completed rejected; ratings
  0 and 6 rejected; one review created; a repeat call is idempotent (same id,
  one row, original rating); another customer gets "Booking not found"; an
  owner cannot review their own page;
- automatic completion: grants; return count; elapsed confirmed →
  completed; future confirmed, elapsed awaiting_payment and cancelled
  untouched;
- cancellation amounts: late customer cancellation of a £10 deposit on a £50
  booking refunds £0 and retains £10 with no refund operation; completed
  booking cannot be cancelled; provider cancellation refunds the full £10 and
  creates exactly one `cancellation` refund operation; attempt states
  `refunded` / `refund_required`;
- discovery: published provider found by area and by category; identical
  draft provider and a published page without a username never returned;
  `matching_treatments` carries the treatment name;
- cross-tenant RLS: provider two sees zero of provider one's treatment,
  treatment_group, availability_rule, blocked_date, provider_location and
  portfolio_image rows; insert under provider one's page violates RLS; update
  affects zero rows.

Run `npm run test:db` on a Docker-capable machine; if an assertion fails on
wording, compare the RAISE text in the migration rather than loosening the
test.

### Bugs the new tests found (fixed)

1. Noon and midnight rendered as `0:00 pm` / `0:30 am` on booking pages, the
   availability form and in emails: `hour12: true` selects the h11 cycle for
   en-GB under ICU. Fixed with `hourCycle: "h12"` in `booking-display.js`,
   `public-provider-format.js` and `availability-form.jsx`.
2. Customer emails printed `Customer email: Unavailable` and `Customer phone:
   Unavailable` because the "omit for customers" filter never matched. Fixed
   with optional lines.
3. The email booking link read `process.env.CEAUTE_APP_URL` directly instead
   of the configuration it had already validated (harmless in production,
   wrong under injection). Fixed by threading `appUrl`.

## 3. Private-alpha readiness

### Must fix before private alpha

1. **Environment separation.** The only linked Supabase project is named
   `ceaute-dev` and I could not confirm which project ceaute.com uses. Decide
   whether alpha runs on this project or a new production project; in either
   case production must have its own Supabase project, Stripe live keys,
   webhook secrets, `CRON_SECRET`, Vault `ceaute_cron_secret`, Resend key and
   `CEAUTE_APP_URL`. `.env.example` is complete for the variables the code reads.
2. **Function region.** Move Vercel functions to `dub1`/`lhr1` (section 1).
3. **Auth email delivery.** Magic-link sign-in depends on Supabase's built-in
   email service unless custom SMTP is configured; the built-in service is
   rate-limited to a handful of emails per hour and not suitable for real
   users. Configure custom SMTP (Resend works) in the Supabase dashboard and
   set site URL / redirect URLs for the production domain (`config.toml`
   still lists `ceaute.vercel.app`).
4. **Stripe live transition.** Live keys, a live Connect webhook (thin events,
   `v2.core.account*`) and a live payments webhook (`checkout.session.*`,
   `payment_intent.*`, `refund.*`) pointing at the production domain; the
   pinned API version `2026-08-26.preview` must be confirmed available in live
   mode. Merchant-of-record and liability wording remain your decision.
5. **Account settings page is non-functional.** Name/email/phone "Save" only
   logs to the console, the phone number is hardcoded to `07342207772`, and
   "Delete account" does nothing. Either wire the personal-details form to the
   existing `profile` update path and remove the delete button, or hide the
   page for alpha.
6. **Legal and support placeholders.** `/terms`, `/privacy`, `/help` are
   labelled placeholders. Real users need at least a contact route and a
   privacy notice before their data is processed. Do not invent them; supply
   the text.
7. **Error visibility.** There is no error boundary (`error.tsx`), no
   `not-found.tsx`, and no error reporting. At minimum add a route-level
   error boundary with a support contact and enable Vercel log drains or a
   lightweight reporter so refund/webhook 500s are seen.
8. **Cron endpoints.** Migration `202609150001` defaults the base URL to
   `https://ceaute.com`; the Vault secrets `ceaute_cron_secret` and optional
   `ceaute_cron_base_url` must exist in the production project or no emails
   are sent and no bookings complete.

### Should fix during private alpha

- Home page `/` is empty; send visitors to `/discover`.
- Not-found pages stream with HTTP 200 because `loading.jsx` sends the shell
  first; acceptable for alpha, wrong for search engines.
- Cancellation/refund wording: screens say "Ceaute refunds/retains"; align
  with the merchant-of-record decision once made.
- Refund failures surface only as a booking-page line ("Support will need to
  review this payment"). Add an operator query or dashboard filter for
  `refund_failed` / `requires_review` operations and failed email outbox rows.
- Backups: confirm the Supabase plan includes daily backups (PITR is a paid
  add-on) and note the restore procedure in a runbook.
- Runbook: document webhook replay from the Stripe dashboard, re-running the
  cron routes by hand with the bearer secret, and what to do when a
  `requires_review` refund appears.
- Accessibility/mobile: the header menu and dashboard nav are usable but the
  dashboard nav has no focus trap and the storefront images use plain `<img>`;
  no blocker found in the code, verify on a real phone.
- Node: `engines` requires 22; this machine runs 21. Vercel's runtime setting
  should be pinned to 22.

### Explicitly defer until evidence demands it

- Caching layers, Redis, or a separate data layer (the region move removes the
  need).
- Guest booking, subscriptions, multi-location UX, repository-wide
  TypeScript conversion (already deferred).
- Admin UI for suspension and review moderation (backend functions exist).
- Appointment reminders and SMS.

## 4. Changes made

| File | Why |
| --- | --- |
| `src/lib/auth/request-session.js` (new) | per-request memoised Supabase client, verified claims and owned provider page |
| `src/app/(dashboard)/dashboard/_lib/provider-data.js` | `getSignedInProvider` uses the shared helpers |
| `src/components/app-header/app-header.jsx` | shares the page's claims/provider lookup; tolerant of lookup failure as before |
| `src/app/(dashboard)/dashboard/onboarding/page.tsx` | uses the shared helpers |
| `src/app/(account)/account/settings/page.jsx` | removed unused provider query (also the lint warning) |
| `src/app/(dashboard)/dashboard/treatments/actions.js` | treatment list and label lookups run concurrently |
| `src/app/(dashboard)/dashboard/bookings/page.jsx` | server component; one request instead of shell + action |
| `src/lib/supabase/signed-urls.js` (new) | batched signed URLs |
| `.../[username]/_lib/storefront-view-model.js`, `.../profile/portfolio/actions.js`, `src/app/discover/actions.js` | use the batch signer |
| `.../book/_components/booking-scheduler.jsx`, `.../book/actions.js` | removed the dead cookie round trip and its two unused actions |
| `src/lib/bookings/booking-display.js`, `.../_lib/public-provider-format.js`, `.../availability/availability-form.jsx` | 12-hour cycle fix (noon bug) |
| `src/lib/emails/booking-emails.js` | app URL threaded from configuration; customer contact lines omitted for customers |
| `package.json` | test script loads `tests/_support/register-alias.mjs` |
| `tests/_support/*` (new) | `@/` alias + extensionless resolution + stubs for privileged client factories |
| `tests/booking-emails.test.js`, `tests/refunds.test.js`, `tests/signed-urls.test.js`, `tests/phone-normalize.test.js` (new); `tests/booking-display.test.js`, `tests/public-provider-format.test.js` (extended) | regression coverage listed in section 2 |
| `supabase/tests/database/mvp_alpha_regressions.test.sql` (new) | database regressions listed in section 2 (not run here) |

## 5. Verification

```
npm test          # 74 tests, 74 pass (was 45)
npm run typecheck # clean
npm run lint      # clean (was 1 warning)
npm run build     # success, all routes dynamic
npm run test:db   # NOT RUN — Docker unavailable on this machine
```

Local smoke test of the production build against the hosted database:
`/sign-in`, `/discover?…`, `/@unknown`, `/help`, `/` returned 200 and the
protected routes redirected (307) with no server errors logged. Authenticated
dashboard routes could not be exercised without a session.

## 6. Decisions required

1. Vercel function region change (recommended `dub1`).
2. Which Supabase project serves the alpha, and creation of a separate
   production project if `ceaute-dev` is to remain a dev database.
3. Custom SMTP for Supabase auth email.
4. Stripe live keys / webhooks and the merchant-of-record wording.
5. Whether to wire or hide the account settings page for alpha.
6. Terms, privacy and support content.
7. Whether to keep the proxy's provider-page lookup (documented behaviour,
   ~25 ms at the edge) or rely on the pages' own guard.

## 7. Recommended next stage

Run `npm run test:db` on a machine with Docker to validate the new pgTAP file,
then make the region change and re-measure ceaute.com with the same curl
timings (targets: `/discover` under 200 ms warm; dashboard pages under 300 ms).
After that, the alpha blockers are configuration and content rather than code:
production Supabase + SMTP, Stripe live, error boundary, and the account
settings page.
