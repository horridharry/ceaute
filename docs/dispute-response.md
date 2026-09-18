# Responding to a payment dispute

This document answers: **a customer has disputed a payment — what does Ceaute
do, by when, and what can it actually get back?**

Ceaute records disputes and tells the operator. It does not respond to them.
Every step below is done by a person in the Stripe Dashboard.

## What the product does on its own

1. Stripe sends `charge.dispute.*` to `POST /api/stripe/payments`.
2. The event is claimed once in the `stripe_payment_event` ledger, so a
   redelivery is not processed twice.
3. `record_stripe_dispute` upserts a row in `booking_dispute`, keyed on the
   Stripe dispute id, and joins it back to the booking through the
   PaymentIntent.
4. For a **material** moment — opened, funds withdrawn, funds reinstated,
   closed — one email is enqueued to the operator through the existing outbox,
   and delivered by the scheduled email route within ten minutes.
   `charge.dispute.updated` is recorded silently, because it fires on evidence
   edits.

It does **not** reverse the transfer, debit the provider, submit evidence, or
accept the dispute. Those are decisions, and they are not made — see
[the refund economics report](reports/2026-09-18-refund-economics-and-provider-liability.md).

## Deadlines

**Stripe's evidence deadline is the one that matters, and missing it loses the
dispute by default.** It is set by the card network, is usually around 7–21
days from the dispute opening, and is in every alert email and in the operator
listing as `evidence_due_at` with `hours_until_evidence_due` alongside it.

Treat the deadline as earlier than it says. Stripe recommends submitting well
before it, and evidence cannot be changed after submission.

## The manual procedure

1. **Read the alert email.** It carries the dispute id, status, reason, amount,
   the response deadline and the booking.
2. **Find every open dispute** with the operator endpoint:

   ```bash
   curl -H "Authorization: Bearer $CEAUTE_OPERATOR_SECRET" \
     https://ceaute.com/api/operator/disputes
   ```

   Add `?include_closed=true` for history. A dispute with
   `booking_matched: false` means Stripe has a charge Ceaute cannot account
   for — look at that one first.
3. **Gather evidence from the booking.** The booking record holds what a card
   network wants: the snapshot of what was agreed, the confirmed appointment
   time, the cancellation window shown before payment, the customer's own
   contact details, and the confirmation email that was sent. For a
   `product_not_received` or `unrecognized` reason, the confirmation email and
   the appointment record are the strongest evidence.
4. **Ask the provider what happened** before deciding whether to fight it. They
   know whether the appointment took place. Do not tell them Ceaute will
   recover the money from them — no such agreement exists yet.
5. **Submit or accept in the Stripe Dashboard.** Accepting is the right answer
   when the customer is plainly correct; it closes the dispute immediately and
   costs the same as losing.
6. **Record who carries it.** Once the outcome is known, set responsibility so
   the intended settlement is explicit and auditable:

   ```bash
   curl -X POST -H "Authorization: Bearer $CEAUTE_OPERATOR_SECRET" \
     -H 'Content-Type: application/json' \
     -d '{"stripe_dispute_id":"dp_...","responsibility":"provider","note":"why"}' \
     https://ceaute.com/api/operator/disputes
   ```

   `provider`, `ceaute` or `undetermined`. The listing then carries a
   `settlement` block showing what each side should bear. **Setting it moves no
   money** — there is no debit mechanism — it records the decision.

   Responsibility drives the outcome: a lost dispute the provider caused means
   they bear the disputed amount and Ceaute returns its 2%; one Ceaute caused —
   a duplicate charge, a wrong amount, a payment-system fault — means Ceaute
   bears the whole cost and the provider bears nothing. Left undetermined, the
   cost sits with Ceaute, which is the safe default but not an answer.

## What Ceaute can actually recover

Contractual responsibility and recoverability are different things, and the gap
is real money:

| | Can it be assigned to the provider? | Can Stripe recover it? |
| --- | --- | --- |
| The disputed amount | Yes, by agreement | Only by a **manual transfer reversal**, which needs funds still in the connected account and **fails once the provider has been paid out** |
| Stripe's £15 dispute fee | In principle | **No.** Stripe's Connect terms forbid passing a dispute fee to a connected account |
| The original processing fee | Yes, by agreement | No — it is never returned |

On a disputed £10.00 deposit, Ceaute is out **£24.80** if nothing is clawed
back, and still **£15.35** after a perfect reversal. The modelled arithmetic is
in `src/lib/payments/refund-settlement.js` and its tests.

**There is no set-off mechanism.** If a provider owes Ceaute for a dispute,
nothing withholds it from their next payout. Collecting it is a conversation,
not a feature.

## Known limitations of this implementation

- **No automatic transfer reversal.** Deliberate: reversing needs a policy
  decision and can push a provider's balance negative.
- **No evidence submission from Ceaute.** All responses happen in Stripe.
- **No provider-facing visibility.** Providers are not told a booking is
  disputed, because the liability question is open and telling them implies an
  answer.
- **Out-of-order events use last-write-wins on `status`.** Replays are
  idempotent, but if Stripe delivers `closed` before `funds_withdrawn` the
  status reflects the last one processed. The set-once timestamps
  (`funds_withdrawn_at`, `funds_reinstated_at`, `closed_at`) are not affected.
- **An unmatched dispute raises no email**, because the outbox is keyed on a
  booking. It is recorded and appears in the operator listing with
  `booking_matched: false`. Check the listing periodically, not only the inbox.
- **One alert per material moment per booking.** A second dispute on the same
  booking would not re-alert. One charge per booking makes this close to
  impossible.

## Configuration

| Variable | Purpose |
| --- | --- |
| `CEAUTE_OPERATOR_EMAIL` | Where dispute alerts go. Falls back to the published contact address, so alerts are never silently dropped. |
| `CEAUTE_OPERATOR_SECRET` | Bearer token for `GET /api/operator/disputes`. Separate from `CRON_SECRET` on purpose: that one is a machine token in Supabase Vault, this one is read by a person. |

The webhook endpoint must also subscribe to the five `charge.dispute.*` events
listed in [the activation checklist](stripe-live-activation.md). Without them
Stripe sends nothing and none of the above happens.
