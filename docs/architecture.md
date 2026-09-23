# Architecture

This document answers: **how is Ceaute organised, where does important behaviour
live, and which boundary is authoritative?** It is a navigation model, not a
file catalogue.

## One App Router application

Ceaute is one full-stack Next.js App Router deployment. Route groups under
`src/app` organise concerns without appearing in URLs:

- `(public-provider)` contains `/@[username]` and the treatment booking journey.
- `(dashboard)` contains the protected provider workspace at `/dashboard`.
- `(account)` contains customer details and bookings at `/account`.
- `(authenticate)` contains `/sign-in`, `/sign-up`, and the `/verify` code screen.
- `(site)` contains the home page, `/discover` public search, `/privacy`, and
  `/terms`.
- `api` contains signed Stripe webhooks and secret-protected scheduled jobs.

`next.config.ts` contains
temporary redirects from legacy `/provider/...`, previous dashboard names, and
the former `/booking/...` public paths. New links and documentation should use
the canonical routes instead of extending the compatibility surface.

## Where a change belongs

Start from the URL of the screen that changes, then read one vertical slice.
The database function in the last column is authoritative for the rule; the
JavaScript before it validates for the user and prepares the screen. The
trade-offs behind this shape are in
[engineering-principles.md](engineering-principles.md).

| Journey | Route and page | Orchestration | Authoritative PostgreSQL |
| --- | --- | --- | --- |
| Sign in, sign up, email code | `src/app/(authenticate)/*` (`/verify` is the code screen) | `(authenticate)/actions.js`, `src/lib/auth/email-otp.js`, `src/lib/auth/redirect.js` | Supabase Auth generates and verifies the code; `profile` row created by trigger |
| Session and ownership guard | `src/proxy.ts` | `src/lib/supabase/proxy.ts`, `src/lib/auth/request-session.js` | RLS on provider-owned tables |
| Create provider page | `/dashboard/onboarding` | `onboarding/actions.ts`, `src/lib/providers/username.js` | `create_provider_page_draft`, `provider_page_username_format` |
| Identity | `/dashboard/profile` | `profile/queries.js`, `profile/actions.js` | `provider_page` RLS and constraints |
| Setup guide, readiness, publish, unpublish, taking bookings | every draft dashboard page (guide), `/dashboard` (Today), `/dashboard/settings/publication` | `dashboard/_lib/publication-checks.js` (one derived setup state), `dashboard/_components/setup-guide.jsx`, `settings/publication/actions.js` | `get_provider_page_publication_checks`, `provider_page_meets_publication_requirements`, `provider_page_accepts_new_bookings`, `publish_provider_page`, `unpublish_provider_page` |
| Portfolio images | `/dashboard/profile/portfolio` | `portfolio/queries.js`, `portfolio/actions.js`, `src/lib/supabase/signed-urls.js` | `portfolio_image` RLS, private storage bucket |
| Saved locations, the current one, private address | `/dashboard/locations` | `locations/queries.js`, `locations/actions.js` | `provider_location` RLS and constraints; `set_primary_provider_location` |
| Working hours and blocked dates | `/dashboard/availability` | `availability/queries.js`, `availability/actions.js`, `availability/_lib/schedule-form.js`, `availability/_lib/booking-messages.js`, `src/lib/bookings/appointment-grid.js` | `replace_provider_availability_rules`, 15-minute grid checks, `blocked_date` RLS, `get_provider_booking_counts_by_local_date` (advisory counts) |
| Treatments | `/dashboard/treatments` | `treatments/queries.js`, `treatments/actions.js`, `treatments/_lib/treatment-values.js` | `treatment` RLS |
| Treatment Groups | `/dashboard/treatment-groups` | `treatment-groups/queries.js`, `treatment-groups/actions.js` | `treatment_group` RLS |
| Add-ons | `/dashboard/add-ons` | `add-ons/queries.js`, `add-ons/actions.js` | table RLS; `create_add_on_with_compatibility`, `update_add_on_with_compatibility` |
| Booking terms | `/dashboard/settings/booking` | `settings/booking/queries.js`, `settings/booking/actions.js`, `src/lib/payments/booking-terms.js` (form and example only) | `booking_terms_are_complete`, `provider_booking_setting_percentage_terms` (new writes), `booking_payment_terms` (the only rounding; [decision 006](decisions/006-percentage-booking-terms.md)) |
| Stripe Connect onboarding | `/dashboard/settings/payments`, `POST /api/stripe/connect` | `settings/payments/queries.js`, `settings/payments/actions.js`, `src/lib/stripe/server.js` | `sync_provider_payment_account`, Connect event claims |
| Public page and discovery | `/@[username]`, `/discover`, `/dashboard/profile/preview` | `src/features/storefront/*`, `[username]/_lib/public-provider-data.js`, `discover/queries.js` | `get_public_*` projections, `provider_page_accepts_new_bookings` (paused state), `discover_public_providers` (published only, paged; `search_public_providers` is kept for the previous deployment) |
| Choose add-ons and time | `/@[username]/book/[treatmentId]`, `/time` | `[username]/_lib/public-provider-data.js`, `book/_lib/appointment-availability.js`, `book/_lib/time-choices.js` | `get_public_availability_rules`, `get_public_blocked_dates`, `get_public_occupied_periods` |
| Review and pay, hold and Checkout | `/@[username]/book/[treatmentId]/checkout` (Review without `?hold`, the held page with it) | `book/actions.js` (`continueToPayment`, `resumeCheckout`), `src/lib/bookings/checkout-session.js` (hold reuse and the Checkout claim, shared with My bookings), `src/lib/bookings/booking-money.js` (formats stored pence), `checkout/_lib/checkout-display.js` (held-page states) | `get_public_booking_terms` (the quote), `create_validated_booking_hold`, `claim_booking_checkout`, `record_booking_checkout_session`, exclusion constraint |
| Payment confirmation | `POST /api/stripe/payments` | `api/stripe/payments/route.ts`, `src/lib/payments/refunds.js` | `claim_stripe_payment_event`, `complete_booking_payment_attempt` |
| Payment disputes | `POST /api/stripe/payments`, `GET /api/operator/disputes` | `src/lib/payments/disputes.js` (event mapping), `refund-settlement.js` (economics, off the live path) | `record_stripe_dispute`, `list_booking_disputes` |
| Booking views | `/account/bookings`, `/dashboard/bookings`, `/dashboard` (Today) | each route's `queries.js` and `actions.js`, `src/lib/bookings/provider-booking-groups.js`, `booking-display.js` (`customerBookingView`, `providerBookingView`), `booking-payment-attempts.js` and `paid-attempt.js` (the attempt that took the money) | `get_customer_booking_summaries`, `get_provider_booking_summaries` (redaction) |
| Cancellation and refund | same booking routes, `GET /api/cron/recover-booking-refunds` | `src/lib/bookings/cancel-booking.js`, `src/lib/payments/refunds.js`, `refund-request.js`, `refund-recovery.js` | `prepare_booking_cancellation`, `claim_booking_refund_operation`, `record_booking_refund_state`, `list_retryable_booking_refund_operations` |
| Inspiration images | `/account/bookings/[bookingId]` (after confirmation), `/dashboard/bookings/[bookingId]` | `account/bookings/actions.js`, `src/lib/bookings/booking-inspiration-images.js` | `booking_inspiration_image` RLS, `can_manage_booking_inspiration_images`, `can_view_booking_inspiration_images`, `add_booking_inspiration_image`, private storage bucket |
| Completion and abandoned-image cleanup, reviews | `GET /api/cron/complete-bookings`, `/account/bookings/[bookingId]` | `api/cron/*`, `src/lib/bookings/discard-inspiration-images.js`, `account/bookings/actions.js` | `complete_elapsed_bookings`, `list_discardable_booking_inspiration_images`, `discard_booking_inspiration_images`, `create_booking_review` |
| Transactional email | `GET /api/cron/send-booking-emails` | `src/lib/emails/booking-emails.js` (delivery), `booking-email-content.js` (text and HTML content), `email-layout.js` (shared HTML layout) | outbox rows enqueued by booking transitions and by `enqueue_late_payment_refund_email` (late-payment refunds); `claim_pending_booking_emails` |
| Account | `/account` (`/account/settings` redirects) | `account/actions.js`, `src/lib/profile/personal-details.js` | `profile` RLS (`profile_update_own_booking_details`) |
| Scheduling | Supabase Cron | migration `202609150001` | `invoke_cron_endpoint` via `pg_cron` and `pg_net` |
| Shared visual foundation | every page; `src/app/layout.tsx`, `src/app/globals.css` | `src/components/ui/*` (see [design-system.md](design-system.md)) | none |

Tests follow the same split: `tests/*.test.js` cover pure JavaScript modules,
`supabase/tests/database/*.test.sql` cover the PostgreSQL rules, and nothing
yet covers the HTTP handlers or Server Actions end to end. The test loader
(`tests/_support/resolve-alias.mjs`) compiles `.jsx`/`.tsx` with the
TypeScript compiler, so a test can render a component that needs no data with
`react-dom/server` and assert on its markup, as
`tests/design-system-primitives.test.js` does.

`src/proxy.ts` refreshes the Supabase session and protects account and dashboard
URLs. Every dashboard URL requires authentication. Every dashboard URL except
`/dashboard/onboarding` also requires the user to already own a provider page.
Server pages and actions still perform their own ownership checks; the proxy is
not the security boundary.

Authentication is a six-digit email code, not a link. `signInWithOtp` asks
Supabase to email the code and `verifyOtp` with type `email` exchanges it for
a session in the same browser, so nothing depends on which browser or mail
scanner opens an email. The email being verified and the return path wait in
the httpOnly `ceaute_pending_auth` cookie between the two screens. The Supabase
email templates in `supabase/templates/` must show `{{ .Token }}` and no link;
the hosted project's copies are pasted into the Dashboard by hand. The
`/auth/confirm` route remains only for links in emails sent before the change.
The evidence behind this is in the
[email code report](reports/2026-09-17-email-otp-and-refund-recovery.md).

## Supabase clients and data access

`src/lib/supabase/server.ts` creates the cookie-aware client for the signed-in
user. Dashboard and account code normally use this client so PostgreSQL sees
the user's JWT and applies RLS. Provider-owned tables have policies which tie
rows back to `provider_page.owner_profile_id`.

`src/lib/supabase/service-role.ts` creates a server-only privileged client. It is
used for public projections, Stripe and scheduled processing, and database
operations intentionally restricted to the trusted backend. The key must never
enter a Client Component, browser bundle, public environment variable, or
client-visible response. Privilege does not make arbitrary table access safe:
public reads select narrow fields or call functions that verify publication,
and trusted mutations call purpose-built PostgreSQL functions.

The `ceaute` schema is exposed through the Supabase data API but grants and RLS
default to denying access. Public provider and availability data is deliberately
projected through server code and narrow database functions rather than opening
the underlying provider and booking tables to anonymous reads.

Those public projections require a published provider page themselves; they do
not trust a caller to have checked first, so a draft or suspended page returns
nothing even when its ID is known. The booking journey under
`/@[username]/book` and discovery use them. The storefront page itself is the
exception: the `[username]/(storefront)` layout and page resolve the page with
one narrow, per-request cached `status = 'published'` query and then `src/features/storefront/storefront-view-model.js` reads the
provider-owned tables directly with the client it is given. That builder is
shared with the dashboard preview, which passes the signed-in user's client so
a draft page renders through RLS. The storefront's publication guarantee
therefore rests on that one upstream check; do not call the builder with a
page that has not been through it. A provider reads their own unpublished page
through the authenticated provider-owned tables, which is why the dashboard,
its preview, and onboarding keep working before publication.

That query runs in the `(storefront)` route group's layout rather than only in
the page because the group's `loading.jsx` streams a fallback before the page
renders; after that, `notFound()` can only mark the response `noindex` with a
200. Checking in that layout keeps a missing or unpublished storefront a real
404. It is deliberately not in the `[username]` layout: checkout for an
existing hold or booking, including Stripe's success and cancel returns, must
keep working after a provider is unpublished or suspended.
`tests/storefront-route-boundaries.test.js` pins this structure.

Portfolio images and display photos live in private buckets
(`portfolio-images`, `provider-display-photos`) whose objects only the owning
provider can reach; the storefront shows them through short-lived signed URLs.
Link-preview crawlers need a stable public URL, so
`[username]/(storefront)/og-image/route.js` streams exactly one image — the
first visible portfolio image of a published page — and answers 404 for
anything else. The route is never cached by the
CDN (`private, no-store`), so a hidden image stops being served at once. Its
absolute URL in `og:image` uses the canonical origin from
`src/lib/app/origin.js` (`CEAUTE_APP_URL`), not the deployment's own host, so
a branch deployment points at `preview.ceaute.com`; with no usable origin the
page simply has no preview image. `provider_page.display_photo_path` is
constrained to the page's own folder, and owners may update that column but no
other platform-managed one. Display-photo cleanup
(`src/lib/providers/display-photo-storage.js`) deletes only files nothing can
reference, so it can never remove the current photo.

Public photo views (hero, Bento, Portfolio preview, gallery) read through one
query, `visiblePortfolioQuery` in `src/features/storefront/portfolio-photos.js`
(visible only, portfolio order), and send the browser `{ id, image_url,
caption }` only. The viewer and the gallery's Bento grid live in
`src/features/photo-viewing`, which imports nothing app-, dashboard- or
data-specific so the gallery and the provider's Portfolio page can share it.
The Bento grid (`galleryBentoTiles`) uses 4:5 cells sized from the grid's
width and photos of one cell or 2 x 2, placed so plain row-major
auto-placement fills the grid in portfolio order with no holes and no image
measurement. Images are full-size originals behind one-hour
signed URLs; the gallery lazy-loads, the viewer loads only the photo in view and
its neighbours, and a failure after most of an hour refreshes the page once
for new URLs. Smaller variants would need Supabase image transformations,
which are not used (a metered feature; production availability unconfirmed).

Public review views (the storefront preview, its rating summary and All
reviews) read through `visibleReviewsQuery` in
`src/features/storefront/review-queries.js` (visible only, newest first, with
an id tie-breaker) and send the browser `{ rating, comment, created_at,
reviewer_name }` only, so no customer identity, booking or review id leaves
the server. `src/features/storefront/reviews.js` holds the pure preview and
naming rules, and `review-card.jsx` is the one card both pages render.
Opening hours read `availability_rule` through
`src/features/storefront/availability-queries.js`; the (storefront) route
group's published check decides who may see them, blocked dates are never
read for display, and `opening-hours.js` turns the rows into open days in
Monday-to-Sunday order. Times are written by `src/lib/time/clock-time.js`,
which the provider's own Availability screen also uses, so both sides read
alike. Neither area needed a migration or a new grant: service_role already
had select on `availability_rule`, and an owner reads their own rows under
the existing policy.

Public treatment views (the storefront preview and All treatments) read
through `treatmentQueries` in `src/features/storefront/treatment-queries.js`
(active rows only, ordered with an id tie-breaker) and group them with
`buildTreatmentSections`. The preview, headings and group filter are pure
rules in `src/features/storefront/treatment-sections.js`, which imports
nothing, so the client filter shares them with the server pages; the preview
is always the top of the All treatments order. The browser receives only the
fields the cards, details sheet and booking link use.

## Where rules are enforced

Application code validates forms, prepares view models, presents useful error
messages, and calculates candidate appointment times. Those checks improve the
experience but are not authoritative when a concurrent request, forged input,
or privileged integration could bypass them.

PostgreSQL is authoritative for the important invariants:

- account and provider ownership, including cross-provider relationships;
- provider publication requirements and protected platform-managed state;
- valid provider settings, including complete percentage booking terms for new
  writes, treatment prices of at least £1.00 and 15-minute working hours;
- the pence a percentage becomes (`booking_payment_terms`, rounded once) and
  whether a page may take a new booking (`provider_page_accepts_new_bookings`:
  terms, Stripe, the current agreement, no balance owed);
- valid booking inputs, active treatment/add-on compatibility, notice, window,
  working hours, blocked dates, and overlap prevention;
- which participant may see private booking information or cancel a booking;
- atomic payment confirmation, cancellation amounts, and refund entitlement;
- idempotent claims for Checkout, Stripe events, refund work, and email work;
- one eligible review per completed booking.

Many of these operations are `security definer` functions with an explicit
`search_path` and tightly granted execution. The browser cannot insert booking
holds or mark payments successful. The service role is also denied generic
booking updates after test confirmation was removed.

The ordered SQL files in `supabase/migrations` are the final source of truth for
implemented schema behaviour. Read them in timestamp order. A descriptive early
migration may be superseded by a later hardening migration, so inspecting a
single `CREATE FUNCTION` is not enough. Database tests in
`supabase/tests/database` exercise the resulting security, consistency,
payment, and replay guarantees.

## Server actions and shared orchestration

Each area splits its server code into two route-local files. `actions.js`
starts with `"use server"` and exports only mutations: they authenticate,
validate input, use the signed-in Supabase client, revalidate routes, and
redirect. Every export of a `"use server"` file is a callable endpoint, so
nothing else belongs there. `queries.js` is a plain server module holding the
read loaders the area's pages call; it is not callable from the browser, and
its loaders still authenticate through `getSignedInProvider` or
`getSignedInCustomer` because they read with the signed-in client. A helper that
both files need goes in the area's own `_lib/`.

A loader that throws reaches the nearest `error` boundary (see Page chrome
below), which shows fixed copy and the error digest, never the thrown message,
because that text can be raw PostgreSQL or Stripe output. The copy lives once in
`src/components/route-error.tsx`.

Add-ons are the one provider form whose save is not a plain table write. An
add-on and the treatments it may be booked with change together in
`ceaute.create_add_on_with_compatibility` and
`ceaute.update_add_on_with_compatibility`, so a rejected treatment leaves no
half-saved add-on behind.

Pending feedback follows one small pattern rather than per-screen state. A
client form that owns its state uses `useActionState` for its own pending flag.
A plain `<form action={serverAction}>` rendered by a Server Component uses
`PendingButton` from `src/components`, which reads React's form status to show
a pending label and block duplicate submission. Forms whose state drives
controlled `<select>` or checkbox inputs submit through
`keepFormValuesOnSubmit` in `src/lib/forms`, because React resets a form after
its action completes and those elements do not survive the reset. Navigation
feedback comes from route-level `loading.js` files plus `LinkPendingHint`
inside navigation links for the slow-network case. Expected external failures,
such as Stripe being unavailable during Connect onboarding, are returned to the
screen as messages; unexpected errors still throw.

Images reach the server as Server Action form data, and Next's default ceiling
for a Server Action body is 1 MB — under both the 5 MB a portfolio image and the
10 MB an inspiration image are allowed to be (a display photo is also capped at
5 MB). `next.config.ts` therefore raises
`experimental.serverActions.bodySizeLimit` to `11mb`. That is a ceiling for
every action, not a per-image limit: the limits that decide are the ones on the
Storage buckets and in the database, and they are what a request bypassing the
screen meets.

Cross-route workflows live under `src/lib`: booking cancellation coordinates a
database cancellation with refund processing; payment modules calculate and
reconcile money; email modules deliver claimed outbox rows; Supabase and Stripe
modules construct trusted clients. Keep transaction decisions in PostgreSQL
rather than trying to simulate a database transaction across several server
actions.

## Frontend ownership

Provider-management areas are independent product sections: Treatments,
Treatment Groups, Add-ons, Locations, Availability, Profile, Portfolio, Preview,
Payments, Booking Settings, Provider Bookings, and Today each own their
presentation, components, queries, actions, and behaviour inside their own
folder under `src/app/(dashboard)/dashboard`. Customer bookings under
`src/app/(account)` are independent of Provider Bookings. A shared route prefix,
tab row, or navigation item does not make two sections one feature, and there
is no umbrella concept over Treatments, Treatment Groups, and Add-ons.

Sections may share only product-agnostic infrastructure:

- `src/components/ui` primitives (tokens, buttons, form fields, page
  container and heading, cards, empty and loading states; see
  [design-system.md](design-system.md)) and `src/components` (header, footer,
  error and not-found content, pending feedback);
- `src/features/navigation` (section tabs), `src/features/storefront` (the
  public storefront, also rendered by the dashboard preview), and
  `src/features/auth/logout-action.js`;
- dashboard infrastructure in `dashboard/_lib` (`getSignedInProvider`, form
  values, price and duration conversion, focused-task routes) and
  `dashboard/_components`;
- `src/components/unsaved-changes`, the dashboard's unsaved-changes guard,
  mounted once in the dashboard layout. A screen opts in with
  `useUnsavedChanges(isDirty)`; only Availability's weekly hours does today,
  and adopting it on another screen is a product decision for that screen.
  Link clicks are caught in the capture phase on `window` and browser Back is
  held with a same-URL sentinel history entry (see
  `src/lib/forms/unsaved-navigation.js`);
- lower-level domain code in `src/lib` (for example
  `src/lib/bookings/provider-booking-groups.js`, read by both Provider Bookings
  and Today, and `src/lib/providers/username.js`, used by Profile and
  Onboarding).

`tests/import-boundaries.test.js` enforces this: no `@/app/` imports, nothing
in `src/features`, `src/components`, or `src/lib` imports from `src/app`, no
dashboard section imports another section's folder, route groups do not import
each other's modules, and no source uses "catalog".

## Page chrome

The root layout renders only the document. Each route group's layout decides
whether the header and footer appear, so no global component keeps a list of
routes. `(site)` and `account` render both; the dashboard renders the header on
every screen, including create and edit screens (since 23 September 2026), and
never renders the footer; `dashboard/_lib/focused-task-routes.js` still lists
those screens so the setup guide stays off them;
`[username]` renders the header and hides the footer inside the booking flow;
`(authenticate)` and `/auth` have no chrome. The header component still chooses
its provider-workspace variant, active link, and logo destination itself.

The root `not-found.tsx` renders the header and footer around the shared
not-found content because unmatched URLs render under the root layout only.
`dashboard` and `[username]` have their own `not-found` so a `notFound()` call
keeps that area's chrome. `(site)`, `account`, `dashboard`, and `[username]`
each have an `error` boundary so a failing page keeps its chrome.

## Availability and booking boundary

`appointment-availability.js` generates the customer-visible candidates from
weekly rules, blocked dates, occupied periods, selected duration, and fixed time
assumptions. It correctly treats local dates in `Europe/London`, including
rejecting nonexistent local times, and converts accepted starts to instants.

The trusted `create_validated_booking_hold` database operation recalculates the
parts that protect correctness before inserting a hold. It verifies the
customer, that the page is taking new bookings, the active treatment,
compatible add-ons, a total of at least £1.00, local working period, blocked
date, 15-minute start, 24-hour notice, and 60-day window, then stores the
percentage terms and the pence they came to in the snapshot. A hold lasts ten
minutes until Checkout is claimed. The
GiST exclusion constraint on provider and half-open time range is the last line
of defence against concurrent overlap.

There are two sources which must currently change together: JavaScript controls
which slots customers see, while PostgreSQL controls which holds are accepted.
Slot generation steps through each working period in 15-minute increments from
its opening time. That only matches the hold check because PostgreSQL requires
stored working-period boundaries to sit on the same grid. The 60-day window is
fixed; the legacy `booking_window_days` column is unused and not writable by
providers.

## Stripe and asynchronous work

Stripe Connect onboarding populates platform-managed payment-account state via
a signed Connect webhook. Booking Checkout is claimed in PostgreSQL before the
external request is made. The exact request payload and idempotency key are
stored so an uncertain creation can be reconciled or safely retried.

The payment webhook is the only confirmation boundary. It verifies Stripe's
signature, claims the event, checks the persisted payment identifiers and exact
amount, and then calls an atomic database operation. The held page Stripe
returns to only reads the resulting state (`heldBookingState` decides what it
says, in a fixed order) and, while a confirmation is on its way, asks the
server again every three seconds for a minute. The Checkout claim refuses an
amount that differs from the snapshot and a provider without the current
agreement or with a balance owed; Stripe's configuration is checked before the
claim so a missing key never holds a time. A paid event that arrives too late or duplicates
another successful attempt creates a full refund entitlement rather than
forcing a stale booking into confirmation.

Cancellation first records the authorised booking transition and calculated
refund entitlement in PostgreSQL. Stripe refund creation is then idempotent and
reconcilable. The booking may already be cancelled while its refund is pending;
screens must not infer external completion from booking status alone.

The transition to confirmed and the transition from confirmed to cancelled
enqueue transactional email in a database outbox through a constraint trigger,
and so does a late-payment refund operation (the customer is told their payment
is being refunded); completion sends nothing. Secret-protected cron routes claim and process email batches and
complete elapsed bookings. Claims expire and retries preserve stable work
identity, because network delivery cannot be assumed to happen exactly once.
An outbox row moves `pending` → `sending` → `sent`, or to `failed` for a
backed-off retry; `cancelled` is a terminal state for an email deliberately
withdrawn before delivery, which the claim never selects and the send and
failure recorders cannot leave.

Supabase Cron is the scheduler for those routes, not Vercel. `pg_cron` jobs
call `ceaute.invoke_cron_endpoint`, which queues an authenticated GET to
`https://ceaute.com` through `pg_net` using the bearer token stored in Supabase
Vault as `ceaute_cron_secret`. The secret is created per project in the Supabase
Dashboard and never appears in a migration; without it the job logs a notice and
sends nothing, so local resets and database tests need no production secret.
Booking completion runs hourly; email delivery and refund recovery run every
10 minutes. Refund recovery asks
`list_retryable_booking_refund_operations` for operations whose synchronous
driver never finished (recorded but never driven, unproven Stripe creation,
abandoned lease, or no webhook for an hour) and hands each one to the same
`processBookingRefund` path, so the pass cannot create a second Stripe refund.
`pg_net` sends each request at most once and does not retry, and an
overlapping or late request is harmless because all three routes rely on the
database claims above.

## Areas that are deliberately complex

Payment, refund, webhook, and outbox code contains more states than the visible
product flow. This is intentional: it distinguishes a definitive failure from
an unknown network outcome and makes retries monotonic. Collapsing those states
or replacing database claims with “check then write” application code can create
duplicate charges, refunds, or messages.

Booking snapshots and address-redaction functions can also look redundant next
to current provider records and component filtering. They protect history and
privacy across every caller, including future callers which do not share today's
UI assumptions. The related decisions are recorded in [decisions](decisions/).
