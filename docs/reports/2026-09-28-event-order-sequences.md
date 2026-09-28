# Event-order sequences — proposal, 28 September 2026

Status: **approved by the owner and built on 28 September 2026 as `npm run local:sequences`; 7 of 10 pass, and the 3 failures are two Ceaute bugs (see Results).** This is step 3 of
the [agent development plan](2026-09-28-ai-development-plan.md).

Each sequence is a set of things happening in an awkward order. The "must be
true after" line is the pass condition; it is what the owner approves. A
sequence passes only when `npm run local:timeline -- <id> --stripe` agrees and
the listed facts hold in the database and in the Stripe sandbox.

## Already covered, not repeated here

These are tested in the database today ([rules and evidence](../rules-and-evidence.md)):

- two customers take the same time at the same moment (race B1);
- a double click on "Continue to payment" for one hold (race B3);
- a late payment delivered twice at once (race B4, `late_payment_refund_email`);
- an older refund message arriving after a newer one (`payment_edge_cases`:
  "A stale event cannot regress refund success");
- a cancellation of a booking that is already cancelled (it answers
  "already cancelled");
- a "payment failed" message for an attempt that already succeeded (ignored).

## Proposed sequences

Examples use the local test provider and customer: Pat (`@local.nails`, £15
flat deposit, free cancellation up to 24 hours before) and Casey.

| # | What happens, in order | Must be true after | Tested today? |
| --- | --- | --- | --- |
| S1 | Casey and Pat cancel the same paid booking at the same moment, once before the 24-hour deadline and once after | The first to reach the database wins (owner decision); the other sees "already cancelled". One cancellation, one refund matching the winner (£15.00 back, or £0 after a late customer cancellation), one set of emails | Only one after the other, never at the same moment |
| S2 | Casey pays. Pat cancels and Casey is refunded. Stripe then sends the "paid" message again | Booking stays cancelled; no second confirmation, refund or email | The repeat is tested alone, never after a cancellation |
| S3 | Casey pays, but the "paid" message is held back until her 10-minute hold has run out and another customer has booked the same time | Casey is refunded £15.00 in full and gets one "we refunded you" email; the other customer's booking is untouched | In the database only, never through the app and Stripe |
| S4 | Casey's card is declined on the first payment page. She starts again from Ceaute and pays on a second page, then also pays on the first, still open in another tab | One booking; the second payment is refunded in full; one refund | In the database only |
| S5 | Casey's card is declined on the first page and she opens a second. The first page's "expired" message arrives while she is paying on the second | Casey's time stays held and her second payment confirms the booking; nothing is refunded | No |
| S6 | Casey pays with Stripe's test card whose refunds fail. Pat cancels | The booking shows the refund as failed, not refunded; the retry job tries again with the same key and then parks it for review; Casey is never told she was refunded | In unit tests only, never against Stripe |
| S7 | Casey is on the payment page when Pat stops taking bookings (for example, Pat's Stripe account becomes restricted). Casey then pays | Casey's booking is confirmed; new customers cannot start a booking | **No test.** docs/product.md promises it |
| S8 | Casey is on the payment page when Pat changes the deposit from £15 to £20. Casey pays, then cancels late | Casey is charged £15; her booking keeps the £15 terms; the late cancellation keeps £15, not £20 | For a percentage at hold time only, not a flat deposit with the payment page open |
| S9 | Casey is on the payment page when Pat moves the drop time later, hiding that date. Casey then pays | Casey's booking is confirmed, if you keep today's behaviour (decision below) | No |

## Results, 28 September 2026

| # | Result |
| --- | --- |
| S1 (before and after the deadline) | Pass. One cancellation won each time and the other was told "already cancelled" |
| S2 | Pass |
| S3 | Pass |
| S4 | **Fail: bug 1** |
| S5 | **Fail: bug 1**. Without a recorded decline, Ceaute reuses the first page, so the premise never happens |
| S6 | **Fail: bug 2** |
| S7, S8, S9 | Pass |

**Bug 1: Ceaute rejects Stripe's "card declined" message.** Stripe creates
a Checkout Session's PaymentIntent only when the customer pays, so
`record_booking_checkout_session` stores none. `payment_intent.payment_failed`
then names a PaymentIntent, and `mark_booking_payment_attempt_failed` raises
"Stripe PaymentIntent does not match the payment attempt" (null is distinct
from any id). The route answers 500, and Stripe retries the message for up to
three days, every time failing. In live mode a failing endpoint can be
disabled by Stripe, which would also stop payment confirmations. The
customer can still retry on the same page, so no booking is lost today.
`payment_intent.canceled` goes through the same check.

**Bug 2: a refund that fails after first succeeding is never recorded.**
Some refunds report `succeeded` and later fail (Stripe's test card ending
5126 does this). `record_booking_refund_state` returns early once an
operation is `succeeded`, so the later `refund.failed` is accepted and
dropped. Ceaute keeps saying the customer was refunded, and nothing is
flagged for review. `local:timeline --stripe` shows the disagreement:
Stripe refunded £0, the database £15.

Also found: the local stack is shared, and another session changing the test
provider mid-run made S6–S9 fail once. The runner now stops when that
happens (docs/verification.md).

## How they run

- Holds, payment pages, cancellations and refunds run Ceaute's own code
  (`create_validated_booking_hold`, `openCheckoutForHold`,
  `cancelBookingWithRefund`) against the real sandbox. S1 fires both
  cancellations at once through that code, rather than through a database
  race script, so the refund really reaches Stripe.
- Payments are real sandbox PaymentIntents made with exactly the
  `payment_intent_data` Ceaute gave Checkout. A Checkout page cannot be paid
  without a browser, so "paid" reaches the app as a `checkout.session.completed`
  built from the real Session and signed with the Stripe CLI secret. Every
  other Stripe message (declined, expired, refund updates) is Stripe's own.
- Time passing is simulated by moving times in the local database.
- A failed check prints the booking's history. Each run starts from a reset
  and a seed. A full run takes about six minutes.

## Decisions (owner, 28 September 2026)

- **S1: the first cancellation wins.** No preference for customer or
  provider. Before the deadline Casey gets £15 back either way; only who
  pays Stripe's fee of about 43p differs. After the deadline the winner
  decides whether Casey gets her deposit back. Letting a provider refund a
  late cancellation afterwards is a separate feature, not decided.
- **S9: keep today's behaviour.** A customer already paying when the drop
  time moves keeps the booking. Record this in docs/product.md with the build.

## The S9 question as asked

**S9:** Casey is on the payment page for Tuesday 6 October. Pat moves that
drop's release to next week, so Tuesday disappears from the page. Casey then
pays.

Today the drop is checked only when a time is first held
(`create_validated_booking_hold`), so Casey's booking stands. The question is
whether to keep that.

- **(Recommended) Keep it: Casey's booking stands.** She was already paying,
  and product.md says bookings already made never change. Pat sees the booking
  and can cancel it with a full refund if the day no longer works.
- **Change it: Casey is refunded automatically**, as with a payment that
  arrives after the hold ran out. This needs a database change.
