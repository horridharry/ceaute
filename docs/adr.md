# Ceaute Architecture Decisions

**Status:** Ready for review  
**Version:** 0.2  
**Last updated:** 28 August 2026

## What this document is for

The [MVP specification](./mvp.md) explains what Ceaute does.

This document records the small number of technical choices that shape how we build it. We keep these decisions because forgetting the reasoning later would create expensive rewrites or confused tickets.

Product rules do not belong here. One active location, fixed deposits and implicit policy acceptance are already explained in the MVP specification.

Each decision answers four questions:

1. What problem are we solving?
2. What have we chosen?
3. Why does that choice fit Ceaute now?
4. What cost or limitation are we accepting?

---

## ADR 1: Build one full-stack Next.js application

**Status:** Accepted

### The problem

Ceaute needs public provider pages, customer booking flows, provider tools, administrator tools and server-side integrations. We could split these into separate frontend and backend applications, but that would create more deployment, authentication and communication work before the core booking loop has been proven.

### The decision

Build Ceaute as one full-stack Next.js application.

The application contains:

- Customer-facing Ceaute, including account and booking journeys.
- Public provider pages at `/@[username]`.
- A protected provider workspace rooted at `/provider`, with provider onboarding at `/provider/onboarding` and a temporary redirect from `/provider/setup`.
- Server-side booking logic.
- API endpoints and payment webhooks.
- The small internal administrator interface.

Sensitive work happens on the server. The browser does not receive payment secrets or privileged database access.

Customer and provider describe how one signed-in account is acting, not separate account types. An explicit validated authentication return path takes priority; otherwise providers enter `/provider` and other users enter `/account`.

### Why this fits Ceaute

One codebase is easier for a solo founder to understand, change and deploy. A provider-page change can use the same types and rules as onboarding and booking without maintaining contracts between separate services.

The important separation is inside the code: booking, payment and provider logic should live in clear modules rather than being mixed into page components.

### What we accept

The frontend and backend are deployed together. If Ceaute later needs independently scaled services or several engineering teams, some modules may move out of the application. Creating that complexity now would solve a future organisational problem, not an MVP problem.

---

## ADR 2: Use Supabase for accounts, PostgreSQL and images

**Status:** Accepted

### The problem

Ceaute needs secure accounts, relational data and portfolio-image storage. Building and operating separate systems for each would slow development, but tightly coupling all business logic to proprietary platform features would make future change harder.

### The decision

Use Supabase for:

- Passwordless email authentication.
- Hosted PostgreSQL.
- Portfolio-image storage.

PostgreSQL is Ceaute's source of truth for providers, availability, bookings, policies and money records.

The Next.js server owns important changes such as publishing a provider, creating a booking, cancelling and refunding. The browser does not write directly to the core booking or payment tables.

Database migrations are stored in the repository. We use PostgreSQL features where they protect correctness. Row-level security remains enabled as another layer of protection, even though privileged operations pass through Ceaute's server.

### Why this fits Ceaute

Supabase gives one project the three foundations the MVP already needs. It supports Next.js, passwordless authentication, PostgreSQL and storage without requiring Ceaute to assemble separate services.

Keeping the real product rules in the application and normal PostgreSQL migrations gives us a realistic exit path: move the database to another PostgreSQL host if necessary. We are not pretending the application could switch to any database without work.

### What we accept

Ceaute depends on Supabase's authentication and storage interfaces. Moving those parts would require a migration. That is acceptable because operating equivalent infrastructure ourselves would cost more now than the flexibility is worth.

References: [Supabase with Next.js](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs), [Supabase Auth](https://supabase.com/docs/guides/auth), [Row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

---

## ADR 3: Calculate availability, then let PostgreSQL prevent overlaps

**Status:** Accepted

### The problem

An appointment does not have one universal slot size. Its length depends on the treatment and selected add-ons. Availability also changes with working hours, blocked dates, minimum notice, existing bookings and temporary checkout holds.

Saving every possible time in advance would create large amounts of disposable data. Checking only in application code would still leave a race: two customers could see the same time and pay at nearly the same moment.

### The decision

Calculate available times when they are requested.

Ceaute combines:

- Weekly working hours.
- Blocked dates.
- The rolling booking window.
- The 24-hour minimum notice.
- Treatment and add-on duration.
- Confirmed bookings.
- Active payment holds.

The application generates possible starts every 15 minutes from the provider's opening time.

PostgreSQL provides the final guarantee. An exclusion constraint rejects overlapping active booking intervals for the same provider, even when concurrent requests pass the earlier availability check.

### Why this fits Ceaute

Availability stays derived from the provider's actual rules rather than a second set of slot records that can become stale. The application gives customers useful times; the database protects the invariant that matters.

### What we accept

The query is more involved than reading pre-generated slots. We will need appropriate indexes and tests around time zones, interval boundaries and simultaneous bookings. That complexity is justified because double booking is a product failure, not a cosmetic bug.

Reference: [PostgreSQL range exclusion constraints](https://www.postgresql.org/docs/current/rangetypes.html#RANGETYPES-CONSTRAINT).

---

## ADR 4: Snapshot every confirmed booking

**Status:** Accepted

### The problem

Providers will change prices, treatment names, addresses, policies and cancellation settings. A booking must continue to show what the customer actually bought, not the provider's latest configuration.

Keeping only links to the current treatment and policy records would allow history to change underneath both parties.

### The decision

When a booking is confirmed, store an immutable copy of the information needed to understand it:

- Provider and customer details relevant to the appointment.
- Treatment and selected add-ons.
- Price and duration.
- Public area, exact address and access instructions.
- Payment, deposit and offline-balance amounts.
- Cancellation deadline and refund rules.
- Provider-written policy text.
- The policy version used at checkout.

The booking may still reference the original provider and treatment records, but historical screens and calculations use the snapshot.

### Why this fits Ceaute

Customers and providers can always see the agreement that applied to that appointment. Refunds use the booking's rules instead of today's settings. Providers can archive or edit services without corrupting history.

### What we accept

Some information is duplicated. That is intentional. The alternative is smaller rows with unreliable history, which is the wrong trade for bookings and money.

---

## ADR 5: Use Stripe Connect direct charges

**Status:** Accepted for the MVP; confirm legal and account configuration before live payments

### The problem

Each booking involves one independent provider delivering a service to one customer. Ceaute needs to collect its fee without manually receiving all revenue and paying providers from an ordinary bank account.

### The decision

Use Stripe Connect connected accounts and create each payment as a direct charge on the provider's connected account.

For each payment:

- The charge belongs to that connected account.
- Stripe places the provider's funds in its connected balance.
- Ceaute collects its commission using an application fee.
- Stripe handles the provider's verification and payout setup.
- Ceaute creates refunds against the connected-account charge.
- When customer policy requires the platform fee to be returned, Ceaute explicitly refunds the application fee as part of the refund flow.

Payment objects remain Stripe's record of movement. Ceaute also stores its own booking-level amounts and Stripe references so support and reconciliation do not depend on querying Stripe for every screen.

### Why this fits Ceaute

Direct charges are designed for a transaction involving one connected account and its customer. The money flow matches Ceaute's provider-by-provider booking model, while application fees support commission without a manual payout system.

### What we accept

Payment records are distributed across connected accounts, making reporting and cross-provider saved-payment experiences less straightforward. Refund responsibility, disputes, statement details and who is treated as the settlement merchant depend on the final Connect account configuration. Those details must be checked with Stripe and reflected in Ceaute's legal terms before real payments launch.

References: [Stripe direct charges](https://docs.stripe.com/connect/direct-charges), [Connect charge types](https://docs.stripe.com/connect/charges), [Application fees](https://docs.stripe.com/connect/marketplace/tasks/app-fees).

---

## ADR 6: Treat payment and booking events as repeatable

**Status:** Accepted

### The problem

Payments, refunds, emails and scheduled booking changes do not all finish inside one browser request. Providers can retry actions, payment services can send the same webhook more than once and background jobs can run again after a failure.

If Ceaute assumes each event happens exactly once, retries could create duplicate bookings, refunds, fees or emails.

### The decision

Important asynchronous operations are idempotent: processing the same event again produces the same result rather than another result.

In practice:

- Store each payment webhook's unique identifier before applying it.
- Give booking, payment and refund actions stable idempotency keys.
- Use explicit booking states and allow only valid transitions.
- Record notification attempts separately from the booking.
- Make background jobs safe to retry.
- Trust verified payment events rather than the customer's return-page redirect.

Successful verified payment changes a held booking to confirmed. Abandoned holds expire. Confirmed appointments become completed after their end time. Cancellation changes state only once the refund has succeeded or has been durably queued.

### Why this fits Ceaute

Retries become a recovery mechanism rather than a corruption risk. Booking state remains understandable even when Stripe or an email provider is temporarily unavailable.

### What we accept

The application needs event records, transition rules and reconciliation tools that a purely synchronous prototype would not need. Because Ceaute handles bookings and money, that reliability work belongs in the MVP.

---

## What is deliberately not an ADR

The following are product assumptions recorded in the MVP specification:

- One active location.
- Ceaute discovery categories and provider treatment groups.
- Fixed deposits for the first launch.
- Commission based on total booking value.
- Booking as implicit acceptance of policies.
- Required but unverified phone numbers during checkout.
- Phone verification before the first review.

They may change when provider behaviour gives us better evidence. None requires a separate architecture record unless a future technical choice makes the change expensive.

---

## What this document now allows us to do

These six decisions are enough to design the domain model and schema without guessing the foundations.

They do not tell us how every class, folder or SQL column should look. That detail belongs in the schema and implementation tickets, where it can be reviewed against a concrete user outcome.
