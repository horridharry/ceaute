# Rules and evidence

This document answers: **which check proves each rule that protects money,
bookings or privacy, and which rules have no check?** The rules themselves are
in [product.md](product.md), [engineering principles](engineering-principles.md#invariants-we-do-not-trade-for-speed)
and [decisions](decisions/). How checks are run and reported is in
[verification](verification.md).

Tests are named by file and by their description text, so `grep` finds them.
**Kind:** `db` is a pgTAP test in `supabase/tests/database/` (`npm run test:db`),
`unit` is a Node test in `tests/` (`npm test`), and `race` is a two-session
script in `scripts/db-races/`, run by hand on a disposable database, not in
CI. **Sequence** means the test drives several events in order, not a single
call.

When a rule in product.md or a decision changes, update its row here in the
same change. A new rule with no check gets a row saying so.

## Booking integrity

| Rule | Evidence | Kind | Gap |
| --- | --- | --- | --- |
| Two customers never hold or book overlapping times with the same provider | `alpha_consistency_hardening`: "The overlap constraint remains the final guard"; `provider_locations`: "Double-booking protection still refuses an overlapping appointment"; `booking-races.sh` B1 "two customers, the same time" | db, race | True concurrency is proven only by the race script, which is manual |
| A hold lasts ten minutes, stretches to Checkout's expiry once Checkout opens, and returns to ten minutes if Checkout is refused | `percentage_booking_terms`: "A new hold lasts ten minutes", "Opening Checkout extends the hold to the Checkout request", "A refused Checkout returns the hold to its original ten minutes", "Recording the Session holds the time exactly until Stripe's expiry" | db, sequence | — |
| A drop's dates stay private and unbookable until its drop time; moving the drop time later hides them again | `availability_drops`: "Dates of a drop whose drop time is still to come are left out", "A date whose drop has not opened is refused", "Moving the drop time later hides the date again" | db, sequence | No test re-reads a booking made while the drop was open to show it is untouched after the drop time moves |
| A booking keeps the terms it was made on when the provider later changes them | `percentage_booking_terms`: "Changing the percentage leaves the existing hold's snapshot alone" | db, sequence | No test edits a treatment's price or duration after a hold and re-reads the snapshot |

## Payments

| Rule | Evidence | Kind | Gap |
| --- | --- | --- | --- |
| Only a verified Stripe webhook confirms a booking, and only when the Session, amount and currency match the attempt | `payment_integrity_hardening`: "A mismatched Checkout Session is rejected", "A mismatched authoritative amount is rejected", "A matching paid Checkout confirms the booking"; `alpha_security_hardening`: "Customers cannot confirm a booking by updating the table", "Customers cannot invoke payment completion" | db | **No test sends the webhook route an event with a bad signature** (`constructEvent` in `src/app/api/stripe/payments/route.ts`) |
| A repeated or concurrent Stripe event changes nothing twice | `payment_integrity_hardening`: "Payment webhook retry attempts are counted", "Concurrent payment webhook processing is rejected", "A completed payment webhook replay is idempotent" (and the Connect equivalents) | db, sequence | — |
| A payment arriving after the hold ended, or a second payment, becomes exactly one refund and one email, never a booking | `late_payment_refund_email`: "A payment after the hold ended becomes a refund, not a booking", "A replayed webhook records no second refund", "A replayed webhook queues no second email"; `payment_integrity_hardening`: "A genuine duplicate payment has exactly one refund operation"; `booking-races.sh` B4 | db, sequence, race | — |
| An event from another environment sharing the Stripe sandbox is ignored without side effects | `stripe_foreign_failure_events`: "A foreign failure event is completed as ignored", "A Stripe retry of the ignored event is acknowledged without reprocessing"; `tests/foreign-payment-events.test.js` | db, unit | — |
| An event from the wrong Stripe mode (test or live) is rejected | `tests/stripe-mode.test.js`: "an event is accepted only when its livemode matches the declared mode" | unit | Tested as a function, not through the route |
| A Checkout Session already open when a provider stops taking bookings can still be paid | — | — | **No test.** product.md states it; the closest tests cover holds made before an agreement change |

## Deposits, cancellations and refunds

| Rule | Evidence | Kind | Gap |
| --- | --- | --- | --- |
| Early customer cancellation and any provider cancellation refund everything paid online | `percentage_booking_terms`: "Early cancellation refunds everything paid", "A provider cancellation refunds everything, even inside the window", and the £15 flat deposit versions | db | Single step; no test runs pay → cancel → Stripe refund against Stripe. `npm run local:timeline -- --stripe` checks this by hand |
| A late customer cancellation keeps at most the agreed commitment and never more than was paid | `percentage_booking_terms`: "Late cancellation of a 30% deposit keeps the whole deposit", "Late cancellation of a £15 flat deposit keeps the whole deposit and refunds nothing", "A refund operation exists exactly where money is refunded"; `tests/booking-display.test.js`: "the retained amount never exceeds what was actually paid online" | db, unit | — |
| A flat deposit is whole pounds, at least £1, and never more than the price | `percentage_booking_terms`: "F1: …", "F2: a booking cheaper than the £10 deposit is paid in full now", "A flat deposit has no maximum and is never more than the price" | db | — |
| A percentage is 10–100% in steps of 5, rounded once, half up, when the hold is made | `percentage_booking_terms`: "E1: …" to "E10: 2499.5p rounds half up to £25.00" and the snapshot checks after them | db | — |
| An interrupted refund is retried with the same idempotency key, never doubled; an unclear Stripe history is parked for review | `tests/refund-recovery-sequence.test.js` (every test); `refund_recovery`: "A recovered requested operation claims as a fresh Stripe refund creation" | unit, db, sequence | The scheduled job calling the recovery route is checked only as a schedule row |

## Publication, privacy and ownership

| Rule | Evidence | Kind | Gap |
| --- | --- | --- | --- |
| A page publishes only through PostgreSQL once all eight requirements are met | `publication_checks_and_agreement`: "Publishing is refused without the current agreement", "A draft without a bio publishes once the agreement is accepted"; `alpha_security_hardening`: "Providers cannot publish by direct update" | db, sequence | — |
| A live page that lapses (agreement, terms, Stripe, money owed) stays published but takes no new bookings | `publication_checks_and_agreement`: "It stays published; nothing unpublishes it", "An outstanding balance pauses new bookings", "A Stripe account that stops being ready pauses new bookings", "The earlier hold can now open Checkout" | db, sequence | — |
| The exact address stays hidden until a booking is paid | `alpha_security_hardening`: "An expired unpaid customer hold has no postcode in its detail summary", "A paid confirmed customer detail includes the postcode"; `alpha_consistency_hardening`: "Cancellation emails never contain private address data" | db | — |
| One provider cannot read or change another provider's data | `provider_locations`: "A provider cannot read another provider"; `alpha_security_hardening`: "Another provider cannot cancel a booking by UUID"; `availability_drops`: "Another provider cannot save a drop on the page" | db | — |
| Each booking email is sent at most once, even on retry | `alpha_consistency_hardening`: "Cancellation enqueues one email per recipient exactly once", "Every retry keeps the outbox ID used as the Resend idempotency key"; `booking_email_cancelled_state`: "A sent row is still never claimed" | db, sequence | — |
| The service-role key never reaches the browser | `src/lib/supabase/service-role.ts` imports `server-only`, so `npm run build` fails if a Client Component reaches it, directly or through another module; `import-boundaries.test.js`: "real tree: no \"use client\" file imports the service-role client", "rule 6 fixture: catches a client module importing the service-role client" | unit | Neither check stops server code passing the key or a service-role result to a Client Component as a prop, or the key being put in a `NEXT_PUBLIC_` variable |

Mapped from the tests on 28 September 2026. Rules not listed here have not
been mapped yet, which does not mean they have no check.
