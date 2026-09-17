# MVP acceptance audit — 17 September 2026

Point-in-time audit of whether the six MVP journeys work end to end at
`main` = `797ab73`. No application code, migration, test, configuration or
hosted data was changed. No Stripe charge, refund, email or form submission
was made.

Evidence types used throughout:

- **AUTO-JS** — `npm test` (Node test runner, fakes for Stripe/Resend/Supabase).
- **AUTO-DB** — `npm run test:db` (pgTAP against a throwaway local database).
- **OBSERVED** — read-only HTTP GETs of public pages on `https://ceaute.com`
  on 17 September (one unsigned POST to the payment webhook to confirm it is
  rejected). The deployed commit could not be confirmed, but every observed
  behaviour matches the source at HEAD.
- **STATIC** — reading the code. Never sufficient for VERIFIED.
- **PRIOR-MANUAL** — reported by an earlier document or by the product owner,
  not repeated here.

## 1. Executive summary

The platform's hard parts are sound. Every automated check passes, including
the database suite, which had never been run on this machine before: 282
pgTAP assertions confirm holds, overlap prevention, checkout claims, payment
completion and replay, cancellation amounts, refund idempotency, refund
recovery listing, email enqueueing, address redaction, publication
projections and review eligibility. All 52 migrations apply cleanly to an
empty database.

No P0 was found. Nothing demonstrated prevents a booking from being paid,
confirmed, cancelled, refunded, completed and reviewed, and no payment or
privacy invariant was found open.

Two approved product decisions are demonstrably not met on the public
provider page, both observed on the deployed site:

1. **The approved treatment-selection interaction does not exist.** There are
   no Select buttons and no details bottom sheet. Every treatment card links
   straight to availability, so a treatment *with* add-ons skips add-on
   selection; add-ons are reachable only through a "Change add-ons" link on
   the time page. No running price is shown while choosing.
2. **The reviews section is shown when empty** ("Reviews — No visible reviews
   yet.") instead of being hidden.

One suspected publication blocker needs a five-minute check: portfolio upload
advertises 5 MB but is a Server Action with Next's default 1 MB body limit,
and a portfolio image is required to publish.

The largest remaining uncertainty is not code but verification: no Server
Action, route handler or page has an automated test, and the real Stripe,
Resend and Supabase Auth integrations were not exercised in this audit.

Tally of 50 acceptance criteria: **26 VERIFIED, 19 IMPLEMENTED — UNVERIFIED,
1 MISSING, 2 BROKEN (B6 and F7 are the same defect), 2 BLOCKED.**

## 2. Repository and branch state

| Item | Finding |
| --- | --- |
| Branch at start | `main`, working tree clean |
| HEAD | `797ab731655e164a4a61149be00ea5c59107d588` |
| `git fetch --all --prune` | no changes; `origin/main` = `797ab73` |
| `main` contains `797ab73` | yes (it is the tip) |
| Open PRs (`gh pr list --state open`) | none |
| Other branches | local `0a` at `797ab73` (no unique commits, no upstream); no remote branches besides `main` |
| Audit branch | `test/mvp-acceptance-audit` created from `797ab73`; it did not previously exist |
| Reports reviewed | `2026-09-16-latency-tests-alpha-readiness.md`, `2026-09-17-architecture-audit.md` (written at `2d42ccf`), `2026-09-17-email-otp-and-refund-recovery.md`, `2026-09-17-test-data-reset-plan.md`, `docs/product.md`, `docs/decisions/` |
| Commits since the architecture audit | `1811130` fix: close MVP alpha critical gaps; `928465d`, `54a44d9` test fixes; `4c321e2` email codes; `061ec8d` refund recovery test; `9c2265b` email redesign; `3d0232c` docs |

## 3. Test execution results

Environment: macOS, Node v25.6.1, npm 11.9.0, Docker available.

| Command | Result |
| --- | --- |
| `npm test` | **139 tests, 139 pass**, 0.64 s |
| `npm run typecheck` | clean (checks the TypeScript files only; `checkJs` is off) |
| `npm run lint` | clean |
| `npm run build` | success; 45 dynamic routes plus proxy |
| `npx supabase db start` | all 52 migrations applied to a fresh local database without error |
| `npm run test:db` | **11 files, 282 assertions, all pass** |
| `npx supabase stop` | local database stopped afterwards |
| `npx supabase migration list --linked` | failed: project not linked on this machine (see section 8) |

The database suite ran only against a local Docker container. The one
notice, "Skipping /api/cron/complete-bookings because the ceaute_cron_secret
Vault secret is not configured", is the expected local behaviour.

Not covered by any automated test (unchanged from `docs/architecture.md`):
every Server Action, every route handler (both webhooks, three cron routes),
every page and component, and all real third-party calls.

## 4. Six-journey acceptance matrix

Status is one of VERIFIED, IMPLEMENTED — UNVERIFIED (I‑U), MISSING, BROKEN,
BLOCKED. Paths are relative to the repository root; `dash/` abbreviates
`src/app/(dashboard)/dashboard/`, `pub/` abbreviates
`src/app/(public-provider)/[username]/`, `mig/` abbreviates
`supabase/migrations/`, `dbt/` abbreviates `supabase/tests/database/`.

### Journey A — Provider onboarding

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| A1 | Email OTP registration and sign-in | I‑U | `src/app/(authenticate)/actions.js:54-171`, `src/lib/auth/email-otp.js`. AUTO-JS: `tests/email-otp.test.js` (17 tests, helpers only). Actions untested. Depends on hosted Dashboard template/OTP-length settings that cannot be read from here (section 8). |
| A2 | Provider account creation | I‑U | `dash/onboarding/actions.ts:12-94` → `create_provider_page_draft` (`mig/202609120014…:90-130`). No test calls the function. |
| A3 | Profile setup and required fields | I‑U | `dash/profile/actions.js:36-128`; username rules AUTO-JS `tests/username.test.js` and AUTO-DB `dbt/mvp_alpha_regressions.test.sql:165-183`. Portfolio upload: see finding F‑3. |
| A4 | Active location | I‑U | `dash/locations/actions.js:56-121`; one row per page (`mig/202609110006…:1-16`). Save path untested. |
| A5a | Treatment groups and treatments | I‑U | `dash/treatments/actions.js`, `dash/treatment-groups/actions.js`. Untested. |
| A5b | Add-ons (provider management) | VERIFIED (database layer) | AUTO-DB `dbt/add_on_compatibility.test.sql`: atomic save, archived treatment rejected, cross-provider update denied. UI inspected, not changed. Data-model note: finding F‑9. |
| A6 | Availability and booking policies | VERIFIED (database layer) | AUTO-DB `dbt/mvp_booking_rules.test.sql:116-201` (grid, deposit > £0); AUTO-JS `tests/appointment-grid.test.js`. Defect F‑5 (blank commitment). |

### Journey B — Provider publication

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| B1 | Stripe Connect onboarding | BLOCKED | `dash/settings/payments/actions.js:105-189`, `src/app/api/stripe/connect/route.ts`. Needs a Stripe test-mode onboarding that writes hosted data; out of bounds for this audit. AUTO-JS `tests/recipient-account.test.js` covers the request shape; AUTO-DB `dbt/alpha_security_hardening.test.sql:357-429` covers "providers cannot falsify Stripe readiness". A published provider exists on hosted, which implies onboarding has worked at least once. |
| B2 | Publication readiness checks | I‑U | JS `dash/profile/publication-readiness.js:89-134` and SQL `provider_page_meets_publication_requirements` (`mig/202609120014…:24-87`) list identical requirements. **No test asserts that an incomplete page is rejected** (architecture finding F7, still open). |
| B3 | Successful publication | VERIFIED | AUTO-DB `dbt/alpha_security_hardening.test.sql:352-403` ("A ready provider can publish through the trusted operation", direct update denied, suspended denied). OBSERVED: `/@cluxeklaws` is live. |
| B4 | Public provider URL | VERIFIED | OBSERVED: `https://ceaute.com/@cluxeklaws` renders; route `pub/page.jsx:11-24`. |
| B5 | Required content enforced (name, biography, portfolio, treatments) | I‑U | Required by both checks at publish time (B2). Reviews are correctly **not** required anywhere. After publishing only the username is protected (`mig/202609170001…:7-9`, AUTO-DB `mvp_alpha_regressions:183`); biography, treatments and images can be removed from a published page (finding F‑8). |
| B6 | Missing reviews handled correctly (section hidden) | **BROKEN** | Finding F‑2. |
| B7 | Publication errors displayed | I‑U | `dash/profile/_components/publication-actions.jsx:16-64` uses `useActionState`; AUTO-JS `tests/publication-outcome.test.js` covers the message mapping only. |

### Journey C — Customer booking and payment

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| C1 | Discovery and direct links | VERIFIED | OBSERVED: `/discover?category=acrylic-nails` lists `/@cluxeklaws`; direct link renders. AUTO-DB `dbt/public_projection_publication.test.sql`, `mvp_alpha_regressions:403-425`. |
| C2 | Approved treatment-selection interaction | **MISSING** | Finding F‑1. |
| C3 | Multiple add-on selection | I‑U | Checkbox form `pub/book/[treatmentId]/page.jsx:50-92`; hold takes `uuid[]` (`mig/202609130003…:93-114`). The hosted provider has one add-on, so two were not observed; no test creates a hold with two add-ons. |
| C4a | Duration calculation | VERIFIED | OBSERVED: Gel 45 min → "1 hr 10 min" with the 25-minute add-on. AUTO-JS `tests/appointment-availability.test.js` ("includes selected add-on duration"); AUTO-DB `alpha_consistency_hardening:97-200` (75-minute end time). |
| C4b | Price calculation | I‑U | Server-side sum in `create_validated_booking_hold` and `pub/_lib/public-provider-data.js:277-282`; client totals are never trusted. No test asserts `total_price_pence` with add-ons. The total is not shown until checkout (part of F‑1). |
| C5 | Selections survive backwards navigation | VERIFIED | OBSERVED: selection lives in the URL (`?add_on=`); "Change add-ons" returns to `/book/[id]?add_on=…` with the box pre-checked. **The `/book/[id]` route and `?add_on=` parameter are live and load-bearing, not obsolete.** |
| C6 | Availability revalidated when duration changes | VERIFIED | OBSERVED: time page recomputes for the new duration. STATIC: checkout re-checks the slot (`pub/book/[treatmentId]/checkout/page.jsx:427-439`). AUTO-DB: the hold re-validates hours, grid, notice and overlap. An incompatible add-on ID returns not-found (OBSERVED). |
| C7 | Availability and appointment holds | VERIFIED | AUTO-JS (11 tests incl. both DST changes); AUTO-DB `alpha_consistency_hardening:97-200`, `mvp_booking_rules:83-109`. |
| C8 | Prevention of double booking | VERIFIED | AUTO-DB: exclusion constraint is the final guard (`alpha_consistency_hardening:186`), slot free again after expiry (`:278`). No concurrent-transaction test. |
| C9 | Customer authentication mid-booking | I‑U | `checkout/page.jsx:217-219`; return path AUTO-JS `tests/email-otp.test.js:242-287`. Round trip not exercised. |
| C10 | Full payment and deposit flows | I‑U | `src/lib/payments/booking-payments.js:11-44`; AUTO-JS deposit cases only; AUTO-DB `payment_integrity_hardening:176-225`. PRIOR-MANUAL: one £15 full payment. Deposit flow never reported as manually run. |
| C11 | Stripe Checkout | I‑U | `pub/book/actions.js:344-557`, `claim_booking_checkout` (`mig/202609130006…`). PRIOR-MANUAL only. See note N‑1 on `allowed_payment_method_types`. |
| C12 | Webhook verification and idempotency | VERIFIED | OBSERVED: unsigned POST to `/api/stripe/payments` → 400. AUTO-DB `payment_integrity_hardening:135-159, 370-403` (claim, lease, replay, mismatch). A real signed event is PRIOR-MANUAL. |
| C13 | Confirmation only after verified payment | VERIFIED | AUTO-DB `alpha_security_hardening:246-261, 474-486` (customer cannot confirm or invoke completion). STATIC: the return page only reads state and never reads `session_id` (`checkout/page.jsx:238-246`). |
| C14 | Private address protection | VERIFIED | AUTO-DB `alpha_security_hardening:292-347`; AUTO-JS `tests/booking-display.test.js`. OBSERVED: public page shows "Stratford, London" only. |

### Journey D — Booking confirmation

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| D1 | Customer booking details | I‑U | `src/app/(account)/account/bookings/[bookingId]/page.jsx:168-241`; view model AUTO-JS `tests/booking-display.test.js`. Page and loader untested. |
| D2 | Provider booking details | I‑U | `dash/bookings/[bookingId]/page.jsx:92-171`. Same. |
| D3 | Customer confirmation email | VERIFIED (content and enqueue) | AUTO-JS `tests/booking-email-content.test.js`, `tests/booking-emails.test.js:165-230`; AUTO-DB `alpha_consistency_hardening:323-363`. |
| D4 | Provider confirmation email | VERIFIED (content and enqueue) | Same tests. |
| D5 | Correct information and access instructions | VERIFIED | Same tests: address in confirmation payloads only, absent from cancellation payloads; Europe/London times. |
| D6 | Queue processing and delivery | I‑U | `src/app/api/cron/send-booking-emails/route.ts`, `src/lib/emails/booking-emails.js:39-131`; AUTO-JS with a fake `fetch`; AUTO-DB claim/retry and schedule. OBSERVED: route returns 401 without the secret. PRIOR-MANUAL: hosted job history showed successful runs. Real Resend delivery not re-tested. |

### Journey E — Cancellation and refunds

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| E1 | Customer cancellation | VERIFIED (database layer) | AUTO-DB `mvp_alpha_regressions:308-390`, `alpha_security_hardening:266-285, 441-459`. Action untested. |
| E2 | Provider cancellation | VERIFIED (database layer) | Same; provider cancel inside the window refunds in full. |
| E3 | Deadlines and refund calculations | VERIFIED | AUTO-DB above; AUTO-JS `tests/booking-display.test.js:146-210`. Untested cases: early customer cancel amount in SQL, 12h/48h windows, paid > commitment. |
| E4 | Stripe refund processing | I‑U | `src/lib/payments/refunds.js:92-214`, `refund-request.js:1-23` (`reverse_transfer: true`). AUTO-JS with a fake Stripe. PRIOR-MANUAL: one successful refund. |
| E5 | Refund idempotency | VERIFIED | Key is a database column (`mig/202609120015…:840`); AUTO-DB `payment_integrity_hardening:325-362`, `payment_edge_cases:171-236`; AUTO-JS `tests/refunds.test.js:113-135`. |
| E6 | Cancellation emails | VERIFIED (content and enqueue) | As D3–D5; redacted. |
| E7 | Recovery of interrupted refunds | I‑U | **Implemented**: `mig/202609170002_recover_stuck_booking_refunds.sql:11-72`, `src/app/api/cron/recover-booking-refunds/route.ts`, `src/lib/payments/refund-recovery.js:9-50`. AUTO-DB `dbt/refund_recovery.test.sql` (listing rules, schedule, lease); AUTO-JS `tests/refund-recovery.test.js`, `tests/refund-recovery-sequence.test.js` (outage → same-key retry, lost response adopted, ambiguity parked). OBSERVED: deployed route answers 401. PRIOR-MANUAL: a normal refund and a cron execution. **A genuinely interrupted refund has never been recovered against Stripe**; the safe procedure is already written in `2026-09-17-email-otp-and-refund-recovery.md` section 5A. |

### Journey F — Completion and reviews

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| F1 | Booking completion | VERIFIED (database layer) | AUTO-DB `mvp_alpha_regressions:264-306`. Route untested. |
| F2 | Review eligibility | VERIFIED | AUTO-DB `mvp_alpha_regressions:189-256`. |
| F3 | Completed-booking requirement | VERIFIED | Same ("not yet completed" rejected). |
| F4 | Phone verification where required | VERIFIED (not required) | Deliberately removed by `mig/202609120011…:1-3`; nothing in `src/` references it. Leftover unused column `profile.phone_verified_at`. |
| F5 | Duplicate reviews prevented | VERIFIED | Unique `booking_id`; AUTO-DB duplicate case. |
| F6 | Public review visibility | I‑U | `pub/_lib/storefront-view-model.js:174-180`. No hosted provider has a review, so not observable; view model untested. |
| F7 | Reviews section hidden when empty | **BROKEN** | Finding F‑2. |

### Hosted deployment

| # | Criterion | Status | Evidence |
| --- | --- | --- | --- |
| H1 | Migrations `202609170001`/`0002` applied to hosted | BLOCKED | Earlier report recorded them as not applied; the product owner has since reported a confirmed cron execution. Cannot be read from this machine (section 8). |

## 5. Confirmed working functionality

Confirmed by a passing test or by observation (26 criteria):

- All five project checks pass; all migrations apply to an empty database.
- Public discovery, direct `/@username` links and the publication gate on
  every public projection.
- Duration recalculation with add-ons, URL-carried selection that survives
  backwards navigation, rejection of incompatible add-on IDs.
- Hold validation (grid, 24 h notice, 60 days, hours, blocked dates,
  compatibility), five-minute expiry, overlap exclusion.
- Webhook rejects unsigned requests; event ledger, leases, replay and
  mismatch handling; bookings cannot be confirmed by a client or a return URL.
- Private address redaction in lists, holds, and cancellation emails.
- Confirmation and cancellation email content and enqueueing.
- Cancellation authorisation, deadline and refund amounts; refund
  idempotency; refund-recovery listing rules and simulated recovery sequences.
- Completion of elapsed bookings; review eligibility, duplicates, own-page
  exclusion.
- Publication through the trusted operation only; published username
  protected.

## 6. Implemented but unverified functionality

Code exists and reads correctly; nothing has demonstrated it in this audit
(19 criteria): A1 OTP round trip, A2 draft creation, A3 profile and portfolio
save, A4 location save, A5a treatments and groups, B2 readiness rejection,
B5 required content, B7 publication error display, C3 two or more add-ons,
C4b price with add-ons, C9 sign-in during booking, C10 deposit flow, C11
Stripe Checkout, D1/D2 booking detail pages, D6 real email delivery, E4 real
Stripe refund, E7 real interrupted-refund recovery, F6 public review display.

The common cause is structural and already documented: no Server Action,
route handler or page has a test, and there is no browser-level test.

## 7. Confirmed broken or missing functionality

### F‑1 · MISSING · P1 — Approved treatment-selection interaction

- **Criterion:** Select buttons; tapping a treatment opens a details bottom
  sheet; Select goes to availability when there are no add-ons and to the
  sheet when there are; multiple add-ons; price and duration update; "Choose
  a time".
- **Evidence:** `pub/_components/storefront-page.jsx:107-119` wraps every
  card in a `Link` to `/book/{id}/time`; there is no button and no sheet
  component anywhere in `src/`. OBSERVED on `/@cluxeklaws`: zero `<button>`
  elements; "Gel" (which has the "Removals" add-on) links straight to
  `/time`. Add-ons are only reachable from `time/page.jsx:74-83` ("Change
  add-ons"), which leads to the server-rendered checkbox page
  `book/[treatmentId]/page.jsx` with a static "Continue" and no running
  total. The time page shows total duration but the base price only.
- **Expected vs actual:** treatment with add-ons → sheet first; actual →
  availability first with no add-ons selected.
- **User impact:** customers are unlikely to discover add-ons; providers lose
  add-on revenue; the customer never sees the combined price before
  checkout. Descriptions do not force an extra step (that part of the
  decision is met).
- **What already works and should be kept:** `?add_on=` URL state,
  `getPublicBookingPage`, server-side price/duration, the `/book/[id]` page
  as the no-JavaScript fallback.
- **Next action:** section 11.

### F‑2 · BROKEN · P1 — Reviews section shown when empty

- **Criterion:** hide the reviews section entirely when there are no reviews.
- **Evidence:** `storefront-page.jsx:126-129` returns an "No visible reviews
  yet." empty state and `:230-233` renders the `Reviews` heading
  unconditionally. OBSERVED on `/@cluxeklaws`: "Reviews | No visible reviews
  yet." The dashboard preview shares the component.
- **User impact:** every new provider's page advertises that it has no
  reviews.
- **Next action:** render the section only when `reviews.length > 0`. A
  few-line change in the same component as F‑1.

### F‑3 · IMPLEMENTED — UNVERIFIED (suspected defect) · P1 until checked — Portfolio upload limit

- **Evidence (STATIC):** upload is a Server Action receiving the file in form
  data (`dash/profile/portfolio/_components/portfolio-page-ui.jsx:49`,
  `portfolio/actions.js:92-117`) and allows 5 MB (`actions.js:9`).
  `next.config.ts` sets no `serverActions.bodySizeLimit`; the bundled Next
  16.3.3 documentation states the default is 1 MB
  (`node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/serverActions.md:29`).
- **Expected vs actual:** a 3 MB phone photo uploads; expected actual: the
  framework rejects the request before the action runs and the provider sees
  a generic error.
- **User impact:** a visible portfolio image is required to publish, so this
  could block Journey B for providers with ordinary photos. The hosted
  provider has two images, so small files work.
- **Next action:** upload one 2–4 MB image in a development environment. If
  it fails, this becomes BROKEN/P1 with a one-line configuration fix.

### F‑4 · IMPLEMENTED — UNVERIFIED (static defect) · P2 — No way to retry an uncertain checkout

`getBookingDisplayState` (`checkout/page.jsx:112-190`) has no branch for
payment status `checkout_creating`; it falls to `canPay: !payment_status`,
so after an uncertain Stripe failure the customer sees "held for 5 minutes"
and no pay button, although the database supports the retry
(AUTO-DB "An uncertain retry reuses the same attempt"). The
`payment=expired|unavailable|processing` query values are preserved but never
rendered. Rare; the customer can start again after the hold expires.

### F‑5 · static defect · P2 — Full-payment settings can save an unpublishable state

`dash/settings/booking/actions.js:13-15, 94-112`: a blank commitment amount
in full-payment mode saves as `null` and reports success, but publication
requires a non-null amount (`mig/202609120014…:70-71`). The provider is told
only "Booking settings with payment and cancellation terms".

### F‑6 · static defects · P2 — Validation errors surface as the generic error page

An invalid phone at checkout (`pub/book/actions.js:99-101`) and any review
rejection (`account/bookings/actions.js:111-132`) throw, so the customer sees
`src/app/error.tsx` rather than a message beside the form.

### F‑7 · static defects · P2 — Small display faults

- A price-only add-on (0 minutes is allowed) renders as "Unavailable"
  duration on booking detail pages (`src/lib/bookings/booking-display.js:23-25`).
- "Change add-ons" is shown for treatments with no add-ons (OBSERVED,
  Manicure).
- The pay step omits the late-cancellation retained amount that the pre-hold
  view shows (`checkout/page.jsx:329-339` vs `:86-110`); the two payment
  calculations agree on amounts.
- Dashboard preview shows every reviewer as "Verified customer" because RLS
  hides other profiles from the owner's client.
- The customer's "Cancelling now refunds X" figure is computed at render; a
  page left open past the deadline applies the late outcome.

### F‑8 · P2 — Required content is enforced at publish time only

After publication a provider can clear the biography, archive every
treatment or hide every image and remain published. Only the username is
protected afterwards.

### F‑9 · Decision needed, not a defect — Add-on ownership model

The decision says add-ons belong to individual treatments with no shared
catalogue. The implementation is a provider-level `treatment_add_on` table
plus a many-to-many `treatment_add_on_compatibility` table
(`mig/202609110004…:1-29`), managed at `/dashboard/add-ons`, and
`docs/product.md:62-63` documents it as many-to-many. Customer-visible
behaviour already satisfies the decision (add-ons are offered per treatment,
several may be chosen, each adds price and duration). Because the provider
UI is not approved for redesign and existing functionality must be
preserved, **no change is recommended**; the product owner should either
accept the existing model or schedule the change deliberately.

### N‑1 · Note — `allowed_payment_method_types`

The stored Checkout payload uses `allowed_payment_method_types: ['card']`
(`mig/202609130006…:149, 204`), which the installed SDK types do not list for
Checkout Sessions. The app pins API version `2026-08-26.preview`
(`src/lib/stripe/server.js:4`), and the PRIOR-MANUAL £15 payment post-dates
that migration, so this is recorded as a note, not a finding. It will be
settled by the first test-mode checkout in the next verification pass.

## 8. Blocked verification

| Item | Why blocked | How to unblock |
| --- | --- | --- |
| Hosted migration and cron state (H1) | Supabase project is not linked on this machine; linking needs credentials and changes local config | Run `supabase migration list --linked` and the queries in the refund-recovery report section 4 from a linked machine |
| Stripe Connect onboarding (B1) | Requires creating a connected account and writing hosted data | Test-mode onboarding in a disposable environment after the planned test-data reset |
| Hosted Supabase Auth templates, OTP length and SMTP (affects A1) | Visible only in the Supabase Dashboard | Check against section 2 of the OTP report |
| Real checkout, refund, interrupted-refund recovery, and email delivery | Audit rules forbid changing hosted data or moving money, even in test mode | One scripted test-mode pass, including procedure 5A for the interrupted refund |
| Deployed commit identity | No Vercel access from this session | Confirm the production deployment is `797ab73` |

## 9. Revalidated architecture findings

Rechecked against `797ab73`; the architecture audit was written at `2d42ccf`.

| Finding | Status at HEAD | Evidence |
| --- | --- | --- |
| A1 Mock account settings | **Resolved** | `src/app/(account)/account/settings/page.jsx:14-23`, `actions.js:12-42`, form uses `useActionState`; AUTO-JS `tests/personal-details.test.js`. No delete-account button (documented as intentional). |
| A2 No refund retry | **Resolved in code**, recovery of a real interrupted refund unverified | See E7. |
| A3 Stripe display-name mismatch | **Resolved** | `src/lib/stripe/recipient-account.js:5-9` reads `display_name`; AUTO-JS "the Stripe account display name comes from provider_page.display_name". |
| A4 Published username protection | **Resolved** | Check constraint `mig/202609170001…:7-9`; AUTO-DB and AUTO-JS tests; provider-facing message in `dash/_lib/username.js:43-49`. Hosted application is H1. |
| A5 Missing error boundaries | **Mostly resolved** | `src/app/error.tsx`, `src/app/not-found.tsx` exist; AUTO-JS `tests/route-error.test.js` ("a thrown database message is never shown"). No `global-error`; not an MVP blocker. Residual: F‑6. |
| A6 Publication feedback discarded | **Resolved** | `publication-actions.jsx:16-64`; mapping tested. Display itself unverified (B7). |
| D1 Untested payment orchestration | **Still open** | No test for `startStripeCheckoutForBooking`, either webhook, the cron routes or `cancelBookingWithRefund`. Recovery sequences are now tested with fakes. |
| D2 Removed Node flag | **Resolved** | `package.json:13`; suite passes on Node 25. |
| D4 `test:db` never run | **Resolved today** | 282 assertions pass, including `mvp_alpha_regressions` and `refund_recovery`. |
| B1 Duplicate payment summary | Still present, amounts agree | No action needed for MVP. |
| F7 Publication rejection untested | **Still open** | See B2. |
| A7 Empty home page, placeholder legal pages | Still open | OBSERVED: `/` shows navigation only. Content, not a journey blocker; legal pages will matter before real customers pay. |

## 10. Prioritised MVP blockers

**P0 — none found.**

**P1**

1. F‑1 Approved treatment-selection interaction is missing (MISSING, observed).
2. F‑2 Reviews section shown when empty (BROKEN, observed).
3. F‑3 Portfolio upload limit — suspected; verify first, fix only if it fails.

**P2**

4. F‑4 No retry for an uncertain checkout.
5. F‑5 Blank commitment saves an unpublishable state.
6. F‑6 Validation errors shown as the generic error page.
7. F‑7 Small display faults.
8. F‑8 Required content not enforced after publication.
9. B2/F7 No test that an incomplete page is refused publication.

**Verification debt (not defects):** one scripted test-mode pass through
onboarding → publish → book with two add-ons → deposit and full payment →
confirm → emails → cancel → refund → interrupted-refund procedure 5A →
complete → review; and confirmation of H1.

**Deferred / out of scope:** add-on model change (F‑9, decision only), home
and legal page content, repeat booking, loyalty, further email presentation,
broad UI redesign, architectural restructuring, `global-error`, review
moderation UI, dead columns.

## 11. Recommended next implementation task

**Implement the approved treatment-selection interaction on the public
provider page, and hide the empty reviews section in the same change.**

Why this one: it is the only approved MVP requirement that is absent, it
sits on the revenue path of Journey C, both P1 findings live in one
component (`storefront-page.jsx`), and everything beneath it already works
and is verified — URL-carried `?add_on=` state, server-side price and
duration, availability recomputation, and hold validation. No migration, no
data-model change and no new route is needed.

Scope boundary for that task:

- Treatment rows with name, price, duration and a Select button; tapping the
  row opens a details bottom sheet.
- Select → `/book/{id}/time` directly when the treatment has no add-ons;
  → the sheet when it has.
- In the sheet: multiple optional add-ons, live total price and duration,
  "Choose a time" → `/book/{id}/time?add_on=…`.
- Keep `/book/[id]` and `?add_on=` as they are; show "Change add-ons" only
  when add-ons exist.
- Render the reviews section only when there is at least one visible review.
- Visual styling follows Claude Design; this task is interaction only.

Before or alongside it, spend five minutes on the F‑3 upload check, because
if it fails it blocks publication and the fix is one configuration line.
