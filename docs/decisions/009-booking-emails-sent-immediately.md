# 009: Booking emails are sent straight away; the 10-minute sweep is the safety net

**Status:** Accepted (28 September 2026), with the product owner.

## Context

The outbox (booking confirmed, booking cancelled, late-payment refund) was
drained only by the 10-minute Supabase Cron call to
`GET /api/cron/send-booking-emails`, so a confirmation could arrive up to 10
minutes late.

## Decision

- The server paths that cause an enqueue — `processCompletedCheckout` in the
  payment webhook, and `cancelBookingWithRefund`, shared by the customer and
  provider cancellation actions — schedule the same delivery pass with Next's
  `after()` through `src/lib/emails/send-booking-emails-now.js`. The immediate
  send is the fast path.
- The unchanged 10-minute sweep (pg_cron job `ceaute-send-booking-emails`,
  migration `202609150001`) is the safety net.
- Duplicates are prevented only by the existing layers: the database claim
  (`claim_pending_booking_emails` with skip-locked leases), the outbox's
  unique key, and the Resend Idempotency-Key set to the outbox row id. No
  JavaScript guard is added.
- The rejected alternative was an every-minute sweep, rejected because on
  Vercel Hobby it costs about 86k invocations a month across production and
  Preview.

## Consequences

No time is promised in docs, interface or email copy. A pass killed mid-send
leaves a row in `sending` until its 5-minute lease expires, after which the
sweep reclaims it. A pass may also deliver any other pending row, including
other bookings' emails and the operator dispute alerts that share the outbox,
which is harmless. What would make this wrong: moving off Next/Vercel `after()`, or
a volume that makes per-request passes costly.

## Reversibility

Low cost. Remove the two calls and the helper; the sweep alone still delivers
everything.
