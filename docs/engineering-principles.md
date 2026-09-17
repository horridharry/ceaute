# Engineering principles

This document answers: **how does Ceaute decide what to build, how much to
build, and when to stop?** It is the reference for trade-offs. Product rules
live in [product.md](product.md), vocabulary in [domain.md](domain.md), the
navigation model in [architecture.md](architecture.md), and non-obvious
choices in [decisions](decisions/).

Ceaute is pre-launch. The goal is a working MVP that real providers and
customers can use so the team learns what the product should become. The goal
is not architectural perfection. Every principle below is a way of spending
effort on learning instead of on structure that has not yet earned its keep.

## The five principles

### 1. Rapid product learning

Prefer the change that gets a real journey in front of a real user soonest.
Measure before optimising: the September 2026 latency work moved the Vercel
region only after timing every hop
([report](reports/2026-09-17-vercel-region-experiment.md)). State a hypothesis
and a success criterion before an experiment, and record the result in
`docs/reports/` so the next person does not repeat it.

### 2. Simple implementation

One Next.js application, one PostgreSQL database, and the fewest moving parts
that make the journey correct. Do not add a layer, a service, a queue, a
cache, a state library, or a build step until a measured problem demands it.
Use the platform's own mechanism first: PostgreSQL constraints and functions
for invariants, Supabase Row Level Security for ownership, Supabase Cron for
scheduling, a database table as the email outbox. Plain JavaScript modules
and Server Actions are enough for the current size of the codebase.

### 3. Reversibility

Prefer decisions that are cheap to undo. Most changes are two-way doors:
make them, ship them, and revert if they are wrong. A one-way door is a
choice that later code, data, or external systems will depend on, such as a
snapshot shape, a payment state machine, a public URL, or a webhook contract.
One-way doors get a decision record in `docs/decisions/` that names what would
make the decision wrong and what reversing it would cost. Compatibility
redirects, unused legacy columns, and additive migrations are acceptable
costs of keeping earlier decisions reversible.

### 4. Low cognitive load

An engineer should find where a change belongs from the URL of the screen it
affects, then read one vertical slice: the route's page, its `actions.js`, the
`src/lib` module it calls, and the database function that is authoritative.
The table "Where a change belongs" in [architecture.md](architecture.md) maps
each journey to that slice. Keep behaviour in the slice that owns it, keep
shared code in `src/lib` only when two routes need it, and keep one pattern
per problem, such as the single pending-feedback pattern. Each document in
`docs/` has one responsibility. Duplicate sources of truth are a bug in the
documentation.

### 5. A working MVP over architectural perfection

Correct and slightly untidy beats elegant and unfinished. Do not refactor
working code unless a product change is blocked by it, a defect is caused by
it, or the refactor removes a duplicate source of truth. When a refactor is
justified, keep it in its own change with no behaviour change, so the diff
can be reviewed as a refactor and reverted as one.

## Necessary versus accidental complexity

Some complexity is the product. Some is left over from how the code was
written. Treat them differently.

**Necessary complexity** protects money, safety, or history and must stay:

- PostgreSQL validates booking holds again and an exclusion constraint
  prevents overlapping active bookings
  ([ADR 001](decisions/001-postgresql-protects-booking-integrity.md)).
- Bookings snapshot the agreed contract and redact private addresses by
  booking state
  ([ADR 002](decisions/002-bookings-snapshot-the-agreement.md)).
- Payment, refund, webhook, and email work is claimed in the database and is
  replay-safe
  ([ADR 003](decisions/003-payment-work-is-verified-and-replay-safe.md)).
- Ownership, publication, and private-address rules are enforced by RLS and
  `security definer` functions, and the service-role key never reaches the
  browser.

**Accidental complexity** can be reduced when it gets in the way, and should
not be added to:

- the same rule written in two places, such as money calculations or
  publication readiness duplicated between JavaScript and SQL;
- dead exports, unused dependencies, and unused columns;
- compatibility surfaces kept beyond the point where anything uses them;
- patterns that differ between routes for no product reason.

The current inventory of both kinds is in the
[architecture audit](reports/2026-09-17-architecture-audit.md).

## Invariants we do not trade for speed

These come first when a principle above conflicts with them:

1. Booking, refund, publication, ownership, and private-address invariants
   are enforced in PostgreSQL. Application checks are for user experience.
2. A booking is confirmed only by the verified Stripe webhook, never by a
   return URL.
3. Row Level Security is not weakened, and `SUPABASE_SERVICE_ROLE_KEY` is
   never exposed to client code or a public environment variable.
4. External work (Stripe, Resend) is claimed in the database before it is
   requested, with a stable idempotency key.

## Checklist for a change

Before starting:

- Which screen or journey does this change? Start from that route.
- Which layer is authoritative for the rule being changed? If it is a
  database rule, change the migration first and the JavaScript second.
- Is this a one-way door? If so, write or update a decision record.

Before opening a pull request:

- `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- `npm run test:db` passes on a Docker-capable machine when a migration or
  database test changed. If it could not be run, say so in the PR.
- The journey was exercised by hand when it crosses Stripe, email, or
  authentication, because those paths have no automated end-to-end test.
- `docs/product.md` or `docs/architecture.md` is updated when observable
  behaviour or a boundary changed.

## When to write a decision record

Write one when a choice is hard to reverse, when it will look like duplicate
work to a future reader, or when it constrains external systems or stored
data. Keep it short: context, decision, consequences, and what would make it
wrong. Do not write one for choices that a later engineer can simply change.

## What "done" means for the MVP

A journey is done when a real user can complete it on the deployed site, the
invariants above hold, the change is covered by the tests that exist for its
layer, and the documentation describes what now happens. Polish, generality,
and optimisation wait for evidence that they are needed.
