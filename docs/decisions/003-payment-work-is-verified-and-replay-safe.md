# 003: Payment work is verified and replay-safe

**Status:** Accepted

## Context

Checkout creation, webhooks, refunds, and email delivery cross network
boundaries. A request can time out after the remote system accepted it. Stripe
can deliver an event more than once or out of order. Treating these operations
as exactly-once would risk duplicate payments, refunds, confirmations, or
messages.

A browser arriving at a success URL proves only that it followed a redirect; it
does not prove the payment details or final state.

## Decision

Claim durable work in PostgreSQL before calling Stripe or Resend. Persist stable
idempotency keys, request identity, expected amounts, and processing state.
Signed Stripe webhooks claim each event and verify it against the persisted
attempt before an atomic database function confirms a booking.

Unknown outcomes remain distinguishable from definitive failures and are
reconciled before retry. A late or duplicate successful payment creates a
recorded refund operation. Cancellation records its refund entitlement before
external refund processing begins.

Stripe Checkout uses destination charges to transfer funds to the provider's
connected recipient account. The fee is an explicit per-attempt value even
though the current fee is zero.

## Consequences

Payment and refund state machines are more complex than the visible journey.
Booking status, payment status, and refund status answer different questions and
must not be collapsed. Return pages may report current state, but must never
confirm payment. Retries must reuse persisted identities rather than create new
external work blindly.
