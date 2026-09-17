# Architecture audit — 17 September 2026

Point-in-time assessment of whether the implementation on `main` (commit
`2d42ccf`) supports the [engineering principles](../engineering-principles.md):
rapid product learning, simple implementation, reversibility, and low
cognitive load, with a working MVP as the goal. It compares the documented
architecture with the code, migrations, integrations, and tests. No
application code was changed in this audit.

## Method and verification

Every file under `src/`, every migration under `supabase/migrations/`, every
pgTAP file under `supabase/tests/database/`, every JavaScript test, and all
documentation were read. Claims below cite file paths; line numbers refer to
the audited commit.

| Command | Result |
| --- | --- |
| `npm test` | 75 tests, 75 pass |
| `npm run typecheck` | clean |
| `npm run lint` | clean |
| `npm run build` | success, 43 dynamic routes plus proxy |
| `npm run test:db` | not run: Docker is unavailable on the audit machine |

Size for orientation:

| Layer | Size |
| --- | --- |
| Application source | 121 files, about 12,100 lines (22 TypeScript, 99 JavaScript) |
| Migrations | 50 files, about 7,800 lines of SQL |
| Database tests | 10 pgTAP files, about 3,000 lines |
| JavaScript tests | 13 files, 75 tests |

## Summary

| Question | Answer |
| --- | --- |
| Can an engineer identify where changes belong? | Mostly yes. Every journey is a vertical slice keyed by URL. The exceptions are shared helpers split without a rule, four conventions for the same error cases, and a few rules duplicated between JavaScript and SQL. `architecture.md` now carries a "Where a change belongs" table. |
| Are responsibilities and dependencies clear? | Yes at the boundary level: PostgreSQL is authoritative, the service-role client is confined to twelve server-only files, and the browser never holds privileged access. Less clear inside the dashboard, where loaders, mutators, and formatting helpers are mixed by convenience. |
| Are booking, payment, and security invariants protected? | Yes. Overlap, hold validation, payment confirmation, refund entitlement, address redaction, ownership, and publication are enforced in PostgreSQL with pgTAP coverage. The gaps are operational, not structural: no scheduled retry of stuck refunds, no error boundaries, and no automated test of the HTTP glue that decides whether Stripe is called. |
| Does unnecessary complexity slow delivery? | Some. It is concentrated in duplication (money and publication rules in two places, near-identical booking screens, five pounds-to-pence parsers), 30 legacy redirects, a dead dependency, and a test runner flag that newer Node versions reject. None of it blocks a product change today. |
| Are significant decisions reversible? | The three recorded decisions are deliberately one-way and now say so. Everything else is two-way: plain modules, additive migrations, a single deployment, and no framework beyond Next.js and Supabase. |
| Do the MVP journeys work end to end? | The provider and booking journeys are complete in code and covered at the database layer. Two customer-facing screens are not finished: the account settings page is a mock and the home page is empty. The webhook, cron, and Server Action glue has only manual verification. |

Overall: the architecture is simpler than its documentation suggested, and
that is good. The database does the hard work, the application is thin, and
the recent hardening migrations show the team already prefers fixing rules in
one authoritative place. The recommended changes are small and none require a
new layer or tool.

## Findings

Severity: **High** blocks or endangers an MVP journey or an invariant.
**Medium** slows delivery or hides failures. **Low** is tidiness with a real
but small cost. Each finding is labelled necessary or accidental complexity
where the distinction matters.

### A. Journeys and correctness

**A1. High. Account settings page is a mock.** The customer settings screen
hard-codes a phone number, its save handler only logs, and the delete-account
button has no handler. Evidence:
`src/app/(account)/account/settings/page.jsx:20`,
`src/app/(account)/account/settings/personal-details-form.tsx:72-74`. The
booking checkout already writes the same profile fields
(`src/app/(public-provider)/[username]/book/actions.js:90-120`), so the fix is
to reuse that path or hide the page. Already listed in the 16 September report;
still open.

**A2. High. Stuck refunds have no automatic retry.** A refund operation that
ends `pending` after an uncertain Stripe outcome is only advanced by a Stripe
`refund.updated` webhook or by another call to `processBookingRefund`. The two
callers are cancellation (`src/lib/bookings/cancel-booking.js:45-47`) and the
duplicate-payment path in the webhook
(`src/app/api/stripe/payments/route.ts:126-132`). The only scheduled jobs are
booking completion and email delivery
(`supabase/migrations/202609150001_schedule_cron_endpoints_with_supabase_cron.sql:74-84`).
There is no admin screen or operator query for `pending`, `failed`, or
`requires_review` operations. The state machine is necessary complexity; the
missing driver is an operational gap.

**A3. High. Stripe accounts are created without a display name.** The
onboarding action reads `providerPage.business_name`, but the object comes
from `getOwnedProviderPage`, whose select returns `display_name`. The value is
always `undefined`. Evidence:
`src/app/(dashboard)/dashboard/settings/payments/actions.js:134`,
`src/lib/auth/request-session.js:17-18`. Cause: two shapes for the same record
(raw row versus form values) with no type to catch the mismatch.

**A4. Medium. A published page can clear or change its username.** The profile
update writes `username: username || null` with no status check
(`src/app/(dashboard)/dashboard/profile/actions.js:46-51,87-91`). PostgreSQL
grants `update (username, ...)` to authenticated users
(`supabase/migrations/202609120014_protect_provider_platform_state.sql:3-10`)
and the only trigger on the table sets `updated_at`. A published page then
404s at its old URL while still reporting `published`. Publication readiness
requires a username, so the rule exists at publish time but not afterwards.

**A5. Medium. No error boundaries.** There is no `error.tsx`, `not-found.tsx`,
or `global-error.tsx` under `src/app`. Loaders throw generic errors and two
actions rethrow raw PostgreSQL messages to the user
(`src/lib/bookings/cancel-booking.js:40`,
`src/app/(account)/account/bookings/actions.js:128`). Only the provider
bookings page works around this locally
(`src/app/(dashboard)/dashboard/bookings/page.jsx:71-80`). Also listed on 16
September; still open.

**A6. Medium. Publish and unpublish outcomes are discarded.** Both actions
return a message string, but the profile page binds them to plain forms that
ignore the return value
(`src/app/(dashboard)/dashboard/profile/page.jsx:54-70`,
`src/app/(dashboard)/dashboard/profile/actions.js:128-157`). A database-side
publish rejection is invisible to the provider.

**A7. Low. Home page is empty and legal pages are placeholders.**
`src/app/page.tsx` renders an empty `main`; `/help`, `/terms`, and `/privacy`
use `src/app/(site)/_components/placeholder-page.jsx`. Content, not
architecture.

**A8. Low. Portfolio reorder is not atomic.** Two updates and a compensating
third (`src/app/(dashboard)/dashboard/profile/portfolio/actions.js:241-267`)
can leave two images with the same `display_order`. Low impact; the add-on
save shows the pattern to copy if it ever matters (one database function).

### B. Where changes belong and cognitive load

**B1. Medium. The same rule is written in two places (accidental).**

| Rule | JavaScript | PostgreSQL or second copy |
| --- | --- | --- |
| Amount due now and later | `src/lib/payments/booking-payments.js:11-44` and a second implementation `calculatePaymentSummary` in `src/app/(public-provider)/[username]/book/[treatmentId]/checkout/page.jsx:86-110` | `claim_booking_checkout` verifies the persisted amounts |
| Publication readiness | `src/app/(dashboard)/dashboard/profile/publication-readiness.js` (six queries per render) | `provider_page_meets_publication_requirements` in `supabase/migrations/202609120014_protect_provider_platform_state.sql:15-97`, execute revoked so JavaScript cannot call it |
| Provider categories | `profile/actions.js:10` and `profile/_components/provider-page-form.jsx:7` | check constraint on `provider_page` |
| Address redaction of a hold | `src/app/(public-provider)/[username]/book/actions.js:254-269` | `redact_booking_private_location` already applied by `get_booking_hold_summary` (`supabase/migrations/202609120013_harden_booking_authorization_and_privacy.sql`) |
| Notice, window, grid | `book/_lib/appointment-availability.js:6-8` | `create_validated_booking_hold` (documented and accepted in ADR 001) |

The last row is necessary and documented. The others are accidental: each
drift shows the user a different answer from the one the database enforces.

**B2. Medium. Duplicated screens and helpers (accidental).** The customer and
provider booking detail pages are near-identical
(`src/app/(dashboard)/dashboard/bookings/[bookingId]/page.jsx:6-90` and
`src/app/(account)/account/bookings/[bookingId]/page.jsx:10-99`), as are the
two booking list pages. Pounds-to-pence parsing exists five times
(`_lib/provider-data.js:53`, `settings/booking/actions.js:10-30`,
`treatments/_components/treatment-form.jsx:83`,
`add-ons/_components/treatment-add-on-form.jsx:80`,
`settings/booking/_components/booking-settings-form.jsx:7`).
`formatDurationMinutes` exists four times with three output formats. The
signed-in-then-route block is repeated in `sign-in/page.jsx:10-29`,
`sign-up/page.jsx:10-29`, and `src/app/auth/confirm/route.ts:28-48`.

**B3. Medium. Four conventions for one situation.** Actions signal failure by
returning a string (most), returning an object (payments), throwing
(cancellation, review, all loaders), or redirecting with a query code
(authentication). Loaders handle a missing row by redirecting (treatments,
add-ons, groups) or returning `null` for the page to call `notFound()`
(bookings). None is wrong; the cost is that a new engineer must read three
slices to learn the house style.

**B4. Low. Shared dashboard helpers are split without a rule.**
`src/app/(dashboard)/dashboard/_lib/form-values.js` and `_lib/provider-data.js`
both hold "shared helpers"; `provider-data.js:93` re-exports a function from
`username.js`. The `getString` helper in `form-values.js` exists but seven
action files inline the same expression instead.

**B5. Low. "Add a field to treatment" touches seven or eight files** with
three hand-written select strings
(`treatments/actions.js:18`, `[username]/_lib/storefront-view-model.js:144`,
`[username]/_lib/public-provider-data.js:42`) and two validation layers. This
is the natural cost of narrow selects and is acceptable at MVP size, but it is
the change most likely to be done incompletely.

**B6. Low. Naming drift.** `display_name` is also `businessName`,
`business_name`, and `display_name` depending on layer; client components are
named `*-page.jsx`, `*-page-ui.jsx`, `*-form.jsx`, and `*-form-ui.jsx`;
`availability-form.jsx` sits beside its page while every other slice uses
`_components/`. `src/app/discover/actions.js` is not a Server Action module.

### C. Boundaries and security

**C1. Verified: the service-role key is server-only.** Twelve files import
`createServiceRoleClient`; none is a Client Component and none serialises a
key or a raw privileged row to the browser. Public reads select narrow fields
or call `get_public_*` functions. Dashboard and account code use the signed-in
client so RLS applies.

**C2. Verified: every mutation re-checks ownership.** Every dashboard action
begins with `getSignedInProvider` and scopes writes by `provider_page_id`; the
RPC-based ones resolve ownership from `auth.uid()` in PostgreSQL. Cancellation
uses the user's client so `prepare_booking_cancellation` authorises the caller
(`src/lib/bookings/cancel-booking.js:31-37`).

**C3. Documented differently from the code: the storefront read path.**
`architecture.md` said public projections "do not trust a caller to have
checked first". That is true for the `/book` loaders and discovery, but the
storefront page performs one `status = 'published'` query and then
`storefront-view-model.js` reads eight tables directly with whatever client it
is given, because the dashboard preview shares the builder
(`src/app/(public-provider)/[username]/page.jsx:19-21`,
`src/app/(public-provider)/[username]/_lib/storefront-view-model.js`). Safe
today; the documentation has been corrected rather than the code.

**C4. Low. The profile username pre-check is dead.** RLS restricts
`provider_page` selects to the owner, so the `ilike` uniqueness query in
`src/app/(dashboard)/dashboard/profile/actions.js:69-85` can only match the
caller's own row, which is excluded. The `23505` handler on line 94 is what
works. The onboarding action documents this (`onboarding/actions.ts:54-56`).

**C5. Low. Booking checkout reads the hold with the service role and checks
ownership in JavaScript** (`src/app/(public-provider)/[username]/book/actions.js:370-390`).
Correct, but it is the one place a booking ownership rule lives outside
PostgreSQL. `get_booking_hold_summary` already authorises the same read.

### D. Tests and verification

**D1. Medium. The code that decides whether Stripe is called is untested at
any layer.** `startStripeCheckoutForBooking` (`book/actions.js:392-604`), the
two webhook handlers, the cron handlers, and `cancelBookingWithRefund` have no
tests, while the modules that decide what to send (`refunds.js`,
`refund-request.js`, `booking-emails.js`) are well covered. The 16 September
report says the same. `refunds.js` already takes injected clients; the
orchestration modules do not.

**D2. Medium. The test runner depends on a Node flag that newer Node rejects.**
`package.json:11` runs `node --experimental-default-type=module`. Module
syntax detection has been on by default since Node 22.7, and the Node 24 CLI
documentation no longer lists the flag, so `npm test` will fail on a Node
upgrade. `engines` says `>=22`. The alias loader in `tests/_support/` also
reimplements bundler resolution in about 70 lines.

**D3. Verified: unit tests are fast and deterministic.** 75 tests in under a
second, no network, all time formatting pinned to `Europe/London`, and the
suite passes under a different `TZ`. Coupling is to the PostgreSQL contract
(RPC names and parameters), which is the intended seam.

**D4. Verified: database invariants are tested.** Hold validation, checkout
claims, payment completion and replay, cancellation amounts, refund lifecycle,
email claims, publication projections, reviews, cross-tenant RLS, and cron
schedules all have pgTAP coverage in `supabase/tests/database/`. The newest
file (`mvp_alpha_regressions.test.sql`) has not been run on a Docker-capable
machine since it was written.

### E. Accidental complexity elsewhere

**E1. Low. Unused dependency and dead exports.** `resend` is in
`package.json` but email delivery uses `fetch` directly
(`src/lib/emails/booking-emails.js:209`). `updateBookingCustomerDetails` in
`book/actions.js:16-54` duplicates `saveCustomerDetails` and is never
imported. `safeNextPath`, the `signOut` alias, and several fields produced by
`treatmentToProviderTreatment` are unused.

**E2. Low. Thirty compatibility redirects.** `next.config.ts` carries
redirects from `/provider/...`, old dashboard names, and `/booking/...`. They
are cheap and reversible; the cost is that a reader must confirm none is
canonical.

**E3. Low. Vendored Stripe skill documents.** `.agents/skills/` holds 30
reference files for Stripe products (Apps, Treasury, Tax, Billing) that Ceaute
does not use. Nothing in the repository references them.

**E4. Low. TypeScript covers under a fifth of the app.** `strict: true` and
`allowJs` are set but `checkJs` is not, so `npm run typecheck` checks 22 of
121 files. Finding A3 is the kind of bug this leaves through. A repository-wide
conversion was explicitly deferred and should stay deferred; adding types at
the two or three shape boundaries that caused bugs is enough.

### F. Database layer

**F1. Verified: the invariants are where the documentation says.** 20 tables
in schema `ceaute`, all with RLS enabled; five ledger tables (payment
attempts, both Stripe event ledgers, the email outbox, refund operations)
have no client policy at all. Every non-trigger function revokes `public`,
every mutating service-role function also asserts `auth.role() =
'service_role'` in its body (for example
`supabase/migrations/202609130003_coordinate_booking_holds_and_checkout.sql:39`),
and the hold, checkout, confirmation, cancellation, refund, email, and
publication rules match `product.md` line for line (see the table in the
next section).

**F2. Medium. Name-resolution patches are applied by string replacement
(accidental).** Three migrations (`202609130001`, `202609130009`,
`202609130010`) fix a PL/pgSQL ambiguity between `RETURNS TABLE` column names
and table columns by fetching each function with `pg_get_functiondef`,
inserting `#variable_conflict use_column` with `replace()`, and re-executing
it (`202609130001_fix_payment_rpc_name_resolution.sql:10-28`). The directive
is in no source definition, so any later `create or replace` of
`claim_booking_checkout`, `prepare_booking_cancellation`, or
`claim_booking_refund_operation` silently loses it, which is exactly what
happened between `130006` and `130009`. The next edit to those functions
should put the directive in the function body.

**F3. Medium. Refund state is written in three places (legacy, accidental).**
`booking_refund_operation` is the durable record, but
`prepare_booking_cancellation` and `record_booking_refund_state` still
dual-write legacy columns on `booking_payment_attempt` and on `booking`
(`202609120015_harden_payment_and_refund_integrity.sql:808-826`,
`202609130007_harden_refund_operations.sql:307-323`). The application reads
the attempt columns for display
(`src/lib/bookings/booking-payment-attempts.js:15`). Consistent today, but a
future refund change must update three writers.

**F4. Low. Database tests mostly exercise a test-only signature.** A 7-argument
`claim_booking_checkout` wrapper with fixed placeholder URLs exists only "to
preserve the SQL test/support signature"
(`202609130006_stabilize_checkout_creation.sql:261-305`). Production calls the
9-argument form (`book/actions.js:465-477`); every pgTAP file except
`payment_edge_cases` calls the wrapper.

**F5. Low. Six ways a hold expires, none scheduled.** Expired holds still
satisfy the exclusion constraint until something cancels them: the next hold
attempt for that provider, a read of the hold summary (a read with a side
effect, `202609120013_harden_booking_authorization_and_privacy.sql:69-73`), a
checkout claim, a Stripe expiry event, or a rejected or retired checkout. The
public occupied-periods projection filters them out, so customers never see a
phantom slot. Correct, but the next engineer must learn all six.

**F6. Low. Leftovers with no caller or writer.** `set_booking_review_visibility`
has no application caller, so the documented "trusted backend" visibility
change has no code path. Payment states `created` and `cancelled` have no
writer since `release_booking_checkout_claim` was dropped. Columns
`provider_page.timezone`, `provider_page.published_at`,
`profile.phone_verified_at`, and `treatment.image_url` (plus the public
`treatment-images` bucket) are unreferenced by `src/`. Three RLS policies are
unreachable because the privilege they govern was revoked, and seven
`grant ... to anon` statements are inert because `anon` has no usage on the
schema. Two overlapping unique indexes exist on `treatment_group` names.

**F7. Low. Publication rejection is untested.** `publish_provider_page` has a
pgTAP test for the ready and suspended cases but none for an incomplete page
being rejected; `create_provider_page_draft` is never called by a test.

## Documentation versus implementation

| Documented | Implemented | Action taken |
| --- | --- | --- |
| Public projections never trust the caller | True for `/book` and discovery; the storefront uses one upstream published check plus a shared builder | `architecture.md` corrected |
| Route-local `actions.js` files hold mutations | They also hold every read loader, all exported as Server Actions | `architecture.md` now says so |
| Booking window is fixed; `booking_window_days` unused and not writable | Confirmed: revoked in `202609140001`, tested in `mvp_booking_rules.test.sql:122` | none |
| Provider cannot change page status; platform-managed state protected | Confirmed by column grants in `202609120014` | none |
| Payment webhook is the only confirmation boundary | Confirmed: return page only reads state (`checkout/page.jsx:238-246`) | none |
| Email and completion run on Supabase Cron | Confirmed: two jobs in `202609150001`; no refund job | Recorded as A2 |
| Confirmed, completed, and cancelled transitions enqueue email | Only confirmation and confirmed-to-cancelled do (`202609130004:105-120`); completion sends nothing | `architecture.md` corrected |
| Review visibility can be changed through the trusted backend | `set_booking_review_visibility` exists with no caller in `src/` | `product.md` corrected |
| Service-role mutations go through purpose-built functions | True by convention; the service role still holds generic insert and update on `booking_payment_attempt` and insert on both Stripe event tables (`202609120002:23-30`) | Recorded as F1 context; no change |
| Hold extends to Checkout expiry, about 31 minutes | Extended to now plus 31 minutes at claim time, then aligned to Stripe's expiry once the session is persisted (`202609130006:43,248-251,470-472`) | Nuance only; `product.md` wording stands |
| Verification is five commands | `test:db` is routinely skipped on this machine | README now asks PRs to say so |

## Prioritised recommendations

Ordered by value to the MVP divided by effort. None adds a layer, a
dependency, or a framework. Items 1 to 4 are alpha blockers or hide failures;
5 to 8 remove duplicate sources of truth; the rest are tidiness for when a
change touches that code anyway.

1. **Finish or hide the account settings page (A1).** Reuse the profile write
   in `book/actions.js` or remove the page from navigation. Half a day.
2. **Add route-level error and not-found boundaries (A5, A6).** One
   `error.tsx` and one `not-found.tsx` at the app root, and show the returned
   message from publish and unpublish. Half a day.
3. **Give stuck refunds a driver (A2).** Either a third Supabase Cron job that
   calls a small `api/cron/process-refunds` route which claims operations in
   `pending` or `requested` state older than a few minutes, or a documented
   manual query for alpha. The database claim function already makes this
   idempotent. One day, or an hour for the runbook alternative.
4. **Fix the Stripe display name (A3)** by passing `display_name`. Ten
   minutes. Then guard published pages against a null username (A4) with a
   check constraint or a trigger in one migration, tested in pgTAP. Half a day.
5. **Remove the second money calculation** in `checkout/page.jsx` and use
   `calculateBookingPaymentAmounts` for both branches (B1). One hour.
6. **Let JavaScript ask PostgreSQL for publication readiness (B1).** Grant
   execute on a wrapper that returns the missing requirements for the caller's
   own page, and delete `publication-readiness.js`. Half a day. Until then, any
   new publication rule must be added in both places.
7. **Make the orchestration testable (D1).** Give `cancelBookingWithRefund` a
   `processRefund` parameter and lift the bodies of the checkout action and
   webhook handlers into functions that accept `{ stripe, supabase }`, then add
   one test each for: refund triggered only when the amount is positive,
   Checkout creation persisted versus recorded uncertain, and a replayed
   webhook returning 200 without reprocessing. One to two days.
8. **Drop the removed Node flag (D2).** Run `node --test` with `"type":
   "module"` or `.mjs` for the test files, and pin the Node version Vercel
   uses. One hour.
9. **Pick one convention for action results and missing rows (B3)** and
   apply it when a slice is next touched. Suggested: return `{ error }` or
   `{ message }` objects from actions; loaders return `null` and pages call
   `notFound()`.
10. **Merge duplicated helpers when touched (B2, B4, E1):** one
    pounds-to-pence parser, one duration formatter in `src/lib`, one signed-in
    routing helper, shared booking detail components. Remove the `resend`
    dependency and the dead exports.
11. **Run `npm run test:db` on a Docker-capable machine (D4)** and record the
    result before the next migration lands. Add the missing rejection test for
    an incomplete page (F7) and switch one checkout test to the 9-argument
    production signature (F4) at the same time.
12. **Put `#variable_conflict use_column` in the source of the three patched
    functions (F2)** the next time any of them is edited, and delete the
    string-replacement migrations' role from the mental model. No separate
    change is needed before then.
13. **Delete `.agents/skills/` Stripe references that Ceaute does not use
    (E3)**, trim redirects once analytics show no traffic (E2), and drop the
    unreferenced columns, dead policies, and inert grants (F6) in one
    housekeeping migration when the database is next touched.

## What should remain untouched

- **The PostgreSQL boundary.** `create_validated_booking_hold`, the GiST
  exclusion constraint, `claim_booking_checkout`,
  `complete_booking_payment_attempt`, `prepare_booking_cancellation`, the
  refund operation functions, the email outbox claims, the `get_public_*`
  projections, `redact_booking_private_location`, and the column grants in
  `202609120014` and `202609140001`. They are the invariants and they are
  tested. Do not move them into JavaScript to "simplify".
- **The chain of hardening migrations.** Eighteen hardening and fix-up
  migrations from `202609120013` to `202609140003` look like churn but each
  replaces a function in place and is additive. Squashing them would lose the record
  and gain nothing until the project resets its database.
- **The payment and refund state machines** in `src/lib/payments/` and the
  webhook handlers' claim, process, complete, fail shape. Their extra states
  are ADR 003's necessary complexity.
- **Booking snapshots and the double redaction.** JavaScript redacting a
  snapshot the database already redacted is harmless defence in depth.
- **The legacy refund columns (F3).** Removing the dual-writes would need a
  data migration and new screens for no product gain. Leave them until a
  refund change forces the question.
- **`src/lib/supabase/*`, `src/lib/auth/request-session.js`,
  `src/proxy.ts`.** Small, correct, and the error-versus-missing distinction
  is right.
- **The vertical-slice layout, the single pending-feedback pattern, the
  add-on and treatment-group actions, `appointment-availability.js`, and the
  batched signed-URL helper.** These are the parts of the codebase a new
  engineer should copy.
- **The single deployment, absence of caching layers, and Supabase Cron.**
  The region move removed the latency case for anything more.
- **The deferred list from 16 September:** guest booking, subscriptions,
  multi-location, repository-wide TypeScript, admin UI, reminders, SMS. Still
  deferred; nothing found here changes that.
