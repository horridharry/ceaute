# Refund economics and provider liability

Date: 18 September 2026. Last revised on branch
`feat/final-refund-dispute-economics`, when the rules below were implemented
rather than merely modelled.

What happens to the money when a booking is refunded or disputed, who bears
what, and what is still not recoverable.

The arithmetic is not prose. `src/lib/payments/settlement-rules.js` decides
every case, `refund-settlement.js` models the resulting ledger, and
`tests/settlement-rules.test.js` asserts each row of the table below. Changing
a rule fails a test.

## The four scenarios, as now implemented

Net position of each party across charge and refund together, on a £50.00
treatment with a £10.00 deposit. Application fee 55p (20p commission + 35p
estimated processing), provider receives £9.45.

| Scenario | Customer | Provider | Ceaute | Stripe |
| --- | --- | --- | --- | --- |
| 1. Customer cancels inside the window — full refund | £0.00 | **£0.00** | −£0.35 | +£0.35 |
| 2. Customer cancels late, whole deposit retained | −£10.00 | +£9.45 | **+£0.20** | +£0.35 |
| 2b. Late on a £50 payment: £10 retained, £40 refunded | −£10.00 | +£8.85 | **+£0.20** | +£0.95 |
| 3. Provider cancels — full refund | £0.00 | **−£0.35** | £0.00 | +£0.35 |
| 4. Dispute lost, provider responsible | £0.00 | −£10.00 | −£0.35 | +£15.35 |

Row 2b is the one to read twice: Ceaute's commission is **2% of the £10.00 the
provider keeps**, not of the £50.00 that briefly passed through. Row 3 is the
other: the provider carries Stripe's charge because the provider caused the
reversal.

The arithmetic is `src/lib/payments/settlement-rules.js`, applied to the ledger
model in `refund-settlement.js`, and every row above is asserted in
`tests/settlement-rules.test.js`.

## How it is executed

`reverse_transfer: true` returns the customer's money from the provider.
`refund_application_fee` is now always **false**, because the boolean can only
return the whole application fee or none of it, and three of the four rows need
a share. The exact share is refunded separately through Stripe's application-fee
endpoint, which Stripe documents as the supported way to do this:

```
application fee refunded = commission collected - 2% of what the provider keeps
                           (+ the processing share, only when Ceaute absorbs it)
```

Ceaute absorbs the processing share in exactly two cases: a customer cancelling
inside the window, and a Ceaute-caused reversal such as a duplicate charge.

The cancelling actor is not new state. `booking.cancelled_by` and
`booking.cancelled_at` already record it, and lateness is derived from the
cancellation window in the booking's own snapshot;
`get_booking_refund_settlement_inputs` reports those facts and the rules decide
from them.

## Contractual responsibility versus what Stripe can recover

Still the gap, and it is where the remaining exposure lives.

| | Assignable by agreement | Recoverable through Stripe |
| --- | --- | --- |
| Processing cost on a refund | Yes | **Yes, automatically** — by refunding less of Ceaute's own fee. Implemented. |
| Ceaute's 2% on a refunded booking | Yes | Yes, same mechanism. Implemented. |
| Disputed amount | Yes | Only by a **manual transfer reversal**, which needs funds still in the connected account and **fails once the provider has been paid out** |
| Stripe's £15.00 dispute fee | **No** | No. Stripe's Connect terms state a dispute fee may not be passed to a connected account |

Refund settlement is now fully recoverable, because it never needs to take
money from a provider — it only decides how much of Ceaute's own fee to hand
back. Dispute recovery is not, because it does.

One consequence worth stating plainly: a provider cancellation leaves the
connected account **35p negative** on that booking. Stripe permits it and
`losses_collector: "application"` means Ceaute covers any shortfall, so the
booking settles either way — but a provider who only ever cancels accrues a
negative balance Ceaute is carrying.

## Decisions still open

1. **Recovering a lost dispute from a provider.** The settlement is computed and
   surfaced; moving the money is manual. An automatic debit needs a mechanism
   that does not exist, and inventing one was out of scope.
2. **Set-off against future payouts.** Without it, clause 6 of the draft
   agreement is unenforceable.
3. **Stripe's dispute fee stays with Ceaute.** Not a provider liability, and
   must not be drafted as one.

## Draft provider-agreement wording — NOT PUBLISHED

**Superseded by implementation.** The canonical rules are now built and tested
(`src/lib/payments/settlement-rules.js`), so the wording below describes what
the code actually does rather than a proposal. It is still **for owner and
legal review only** — do not paste it into `/terms`. Clause 4 states a
liability Ceaute has no mechanism to enforce, and clause 6 depends on a set-off
mechanism that does not exist.

> **What you are paid, and what happens if a booking is refunded**
>
> 1. The customer pays the price you advertise. Two amounts are deducted from
>    each payment Ceaute processes for you: Stripe's charge for taking the
>    payment, which is Stripe's cost and not money Ceaute keeps, and Ceaute's
>    platform fee of 2%. You receive the rest. Both apply only to money taken
>    through Ceaute; a deposit's offline balance is yours in full.
>
> 2. **If a customer cancels within your cancellation window**, they are
>    refunded in full. You receive nothing for that booking and you pay
>    nothing: Ceaute returns its platform fee and absorbs Stripe's charge
>    itself. A cancellation inside your own window costs you £0.
>
> 3. **If a customer cancels after your window**, your cancellation policy
>    decides what you keep. Ceaute's 2% is then charged on the amount you
>    actually keep, not on the original payment, and any platform fee collected
>    above that is returned to you. Stripe's charge on the original payment is
>    not returned by Stripe to anyone, and it remains your cost.
>
> 4. **If you cancel a confirmed booking**, the customer is refunded in full.
>    Ceaute returns its platform fee. Stripe's charge on the original payment
>    is not returned and, because the cancellation was yours, it is your cost.
>
> 5. **If a customer disputes a payment with their bank**, Ceaute records the
>    dispute, responds to it, and will ask you for the information needed to
>    answer it. Ceaute does not insure you against chargebacks. If the dispute
>    is lost and the booking was your responsibility, the disputed amount is
>    yours to bear and Ceaute returns its platform fee. If the dispute was
>    caused by a Ceaute error — a duplicate charge, a wrong amount, or a fault
>    in Ceaute's payment system — Ceaute bears the whole cost and you bear
>    nothing.
>
> 6. Where an amount is yours to bear and cannot be taken from your Stripe
>    balance, Ceaute will ask you for it directly and may set it off against
>    later payments due to you. [Set-off has no mechanism today.]

Two clauses need a decision before any of this is published:

- **Clause 5 cannot be enforced automatically.** Recovering a lost dispute from
  a provider needs a transfer reversal, which requires funds still in their
  Stripe balance and fails once they have been paid out. The dispute surface
  computes what *should* happen and an operator acts on it by hand.
- **Stripe's dispute fee is not covered by clause 5 and must not be.** Stripe's
  Connect terms state a dispute fee may not be passed to a connected account.
  It stays with Ceaute. This is recorded as an activation blocker, not as a
  provider liability.

## What the implementation does and does not do

Implemented and tested: the four refund causes, the commission charged on the
retained amount, the application-fee refund that executes each one, the
cancelling actor derived from `booking.cancelled_by`, dispute responsibility,
and the settlement each dispute outcome should reach.

Not implemented, deliberately: any automatic debit or transfer reversal against
a provider, automatic evidence submission, and set-off against future payouts.
Each needs a mechanism that does not exist, and inventing one was out of scope.
