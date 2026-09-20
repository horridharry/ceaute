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
- `api` contains signed Stripe webhooks and secret-protected scheduled jobs.

The ungrouped `/discover` route is public search. `next.config.ts` contains
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
| Create provider page | `/dashboard/onboarding` | `onboarding/actions.ts` | `create_provider_page_draft` |
| Identity, publish, unpublish | `/dashboard/profile` | `profile/actions.js`, `profile/publication-readiness.js` (screen hints only) | `publish_provider_page`, `unpublish_provider_page` |
| Portfolio images | `/dashboard/profile/portfolio` | `portfolio/actions.js`, `src/lib/supabase/signed-urls.js` | `portfolio_image` RLS, private storage bucket |
| Saved locations, the current one, private address | `/dashboard/locations` | `locations/actions.js` | `provider_location` RLS and constraints; `set_primary_provider_location` |
| Working hours and blocked dates | `/dashboard/availability` | `availability/actions.js`, `src/lib/bookings/appointment-grid.js` | `replace_provider_availability_rules`, 15-minute grid checks |
| Treatments, groups, add-ons | `/dashboard/treatments`, `/dashboard/treatment-groups`, `/dashboard/add-ons` | each route's `actions.js`, `_lib/form-values.js` | table RLS; `create_add_on_with_compatibility`, `update_add_on_with_compatibility` |
| Booking terms | `/dashboard/settings/booking` | `settings/booking/actions.js`, `src/lib/payments/booking-payments.js` | `provider_booking_setting` constraints (positive deposit) |
| Stripe Connect onboarding | `/dashboard/settings/payments`, `POST /api/stripe/connect` | `settings/payments/actions.js`, `src/lib/stripe/server.js` | `sync_provider_payment_account`, Connect event claims |
| Public page and discovery | `/@[username]`, `/discover` | `[username]/_lib/*`, `discover/actions.js` | `get_public_*` projections, `search_public_providers` (published only) |
| Choose add-ons and time | `/@[username]/book/[treatmentId]`, `/time` | `[username]/_lib/public-provider-data.js`, `book/_lib/appointment-availability.js` | `get_public_availability_rules`, `get_public_blocked_dates`, `get_public_occupied_periods` |
| Hold and Checkout | `/@[username]/book/[treatmentId]/checkout` | `book/actions.js` | `create_validated_booking_hold`, `claim_booking_checkout`, `record_booking_checkout_session`, exclusion constraint |
| Payment confirmation | `POST /api/stripe/payments` | `api/stripe/payments/route.ts`, `src/lib/payments/refunds.js` | `claim_stripe_payment_event`, `complete_booking_payment_attempt` |
| Payment disputes | `POST /api/stripe/payments`, `GET /api/operator/disputes` | `src/lib/payments/disputes.js` (event mapping), `refund-settlement.js` (economics, off the live path) | `record_stripe_dispute`, `list_booking_disputes` |
| Booking views | `/account/bookings`, `/dashboard/bookings` | each route's `actions.js`, `src/lib/bookings/booking-display.js`, `booking-payment-attempts.js` | `get_customer_booking_summaries`, `get_provider_booking_summaries` (redaction) |
| Cancellation and refund | same booking routes, `GET /api/cron/recover-booking-refunds` | `src/lib/bookings/cancel-booking.js`, `src/lib/payments/refunds.js`, `refund-request.js`, `refund-recovery.js` | `prepare_booking_cancellation`, `claim_booking_refund_operation`, `record_booking_refund_state`, `list_retryable_booking_refund_operations` |
| Inspiration images | `/@[username]/book/[treatmentId]/checkout`, `/account/bookings/[bookingId]`, `/dashboard/bookings/[bookingId]` | `book/inspiration-actions.js`, `account/bookings/actions.js`, `src/lib/bookings/booking-inspiration-images.js` | `booking_inspiration_image` RLS, `can_manage_booking_inspiration_images`, `can_view_booking_inspiration_images`, `add_booking_inspiration_image`, private storage bucket |
| Completion and abandoned-image cleanup, reviews | `GET /api/cron/complete-bookings`, `/account/bookings/[bookingId]` | `api/cron/*`, `src/lib/bookings/discard-inspiration-images.js`, `account/bookings/actions.js` | `complete_elapsed_bookings`, `list_discardable_booking_inspiration_images`, `discard_booking_inspiration_images`, `create_booking_review` |
| Transactional email | `GET /api/cron/send-booking-emails` | `src/lib/emails/booking-emails.js` (delivery), `booking-email-content.js` (text and HTML content), `email-layout.js` (shared HTML layout) | outbox rows enqueued by booking transitions; `claim_pending_booking_emails` |
| Scheduling | Supabase Cron | migration `202609150001` | `invoke_cron_endpoint` via `pg_cron` and `pg_net` |

Tests follow the same split: `tests/*.test.js` cover pure JavaScript modules,
`supabase/tests/database/*.test.sql` cover the PostgreSQL rules, and nothing
yet covers the HTTP handlers or Server Actions end to end.

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
exception: `[username]/page.jsx` resolves the page with one narrow
`status = 'published'` query and then `storefront-view-model.js` reads the
provider-owned tables directly with the client it is given. That builder is
shared with the dashboard preview, which passes the signed-in user's client so
a draft page renders through RLS. The storefront's publication guarantee
therefore rests on that one upstream check; do not call the builder with a
page that has not been through it. A provider reads their own unpublished page
through the authenticated provider-owned tables, which is why the dashboard,
its preview, and onboarding keep working before publication.

## Where rules are enforced

Application code validates forms, prepares view models, presents useful error
messages, and calculates candidate appointment times. Those checks improve the
experience but are not authoritative when a concurrent request, forged input,
or privileged integration could bypass them.

PostgreSQL is authoritative for the important invariants:

- account and provider ownership, including cross-provider relationships;
- provider publication requirements and protected platform-managed state;
- valid provider settings, including positive deposits and 15-minute working
  hours;
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

Most provider form orchestration is route-local in `actions.js` files beside the
dashboard area it serves. These actions authenticate, validate input, use the
signed-in Supabase client, revalidate routes, and redirect. This keeps a
vertical slice easy to find. The same `"use server"` files also export the
read loaders their pages call, so every exported function is a callable
endpoint and must authenticate first; all of them currently do, through
`getSignedInProvider` or `getSignedInCustomer`. `src/app/error.tsx` and
`src/app/not-found.tsx` are the route-level boundaries: a loader that throws
shows fixed copy and the error digest, never the thrown message, because that
text can be raw PostgreSQL or Stripe output. Treatments, treatment groups, and add-ons each own
the actions under their own route, so treatment logic, group archival, and
add-on compatibility can be read separately; the public booking action module
remains a deliberate candidate for later simplification.

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
10 MB an inspiration image are allowed to be. `next.config.ts` therefore raises
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

## Availability and booking boundary

`appointment-availability.js` generates the customer-visible candidates from
weekly rules, blocked dates, occupied periods, selected duration, and fixed time
assumptions. It correctly treats local dates in `Europe/London`, including
rejecting nonexistent local times, and converts accepted starts to instants.

The trusted `create_validated_booking_hold` database operation recalculates the
parts that protect correctness before inserting a hold. It verifies the
customer, published page, active treatment, compatible add-ons, local working
period, blocked date, 15-minute start, 24-hour notice, and 60-day window. The
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
amount, and then calls an atomic database operation. The Checkout success page
only reads the resulting state. A paid event that arrives too late or duplicates
another successful attempt creates a full refund entitlement rather than
forcing a stale booking into confirmation.

Cancellation first records the authorised booking transition and calculated
refund entitlement in PostgreSQL. Stripe refund creation is then idempotent and
reconcilable. The booking may already be cancelled while its refund is pending;
screens must not infer external completion from booking status alone.

The transition to confirmed and the transition from confirmed to cancelled
enqueue transactional email in a database outbox through a constraint trigger;
completion sends nothing. Secret-protected cron routes claim and process email batches and
complete elapsed bookings. Claims expire and retries preserve stable work
identity, because network delivery cannot be assumed to happen exactly once.

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
