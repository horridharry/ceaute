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
- `(authenticate)` contains `/sign-in` and `/sign-up`.
- `api` contains signed Stripe webhooks and secret-protected scheduled jobs.

The ungrouped `/discover` route is public search. `next.config.ts` contains
temporary redirects from legacy `/provider/...`, previous dashboard names, and
the former `/booking/...` public paths. New links and documentation should use
the canonical routes instead of extending the compatibility surface.

`src/proxy.ts` refreshes the Supabase session and protects account and dashboard
URLs. Every dashboard URL requires authentication. Every dashboard URL except
`/dashboard/onboarding` also requires the user to already own a provider page.
Server pages and actions still perform their own ownership checks; the proxy is
not the security boundary.

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
nothing even when its ID is known. A provider reads their own unpublished page
through the authenticated provider-owned tables instead, which is why the
dashboard, its storefront preview, and onboarding keep working before
publication.

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
vertical slice easy to find. Treatments, treatment groups, and add-ons each own
the actions under their own route, so treatment logic, group archival, and
add-on compatibility can be read separately; the public booking action module
remains a deliberate candidate for later simplification.

Add-ons are the one provider form whose save is not a plain table write. An
add-on and the treatments it may be booked with change together in
`ceaute.create_add_on_with_compatibility` and
`ceaute.update_add_on_with_compatibility`, so a rejected treatment leaves no
half-saved add-on behind.

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

Confirmed/completed/cancelled transitions enqueue transactional email in a
database outbox. Secret-protected cron routes claim and process email batches and
complete elapsed bookings. Claims expire and retries preserve stable work
identity, because network delivery cannot be assumed to happen exactly once.

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
