# Refund economics and provider liability

Date: 18 September 2026. Branch: `fix/refund-economics-and-provider-liability`.

What actually happens to the money when a booking is refunded or disputed, and
the one decision that is blocking. Modelled on a **£50.00 treatment with a
£10.00 deposit**, priced by the real calculation: application fee 55p (Ceaute's
2% = 20p + estimated Stripe 35p), provider receives £9.45.

The arithmetic here is not prose — it is `src/lib/payments/refund-settlement.js`
and asserted in `tests/refund-settlement.test.js`. Change the refund flags and
those tests fail.

## The four scenarios

Net position of each party across charge and refund together. Ceaute's intended
margin is **+20p**.

| Scenario | Customer | Provider | Ceaute | Stripe |
| --- | --- | --- | --- | --- |
| 1. Customer cancels before the deadline — full refund | £0.00 | £0.00 | **−£0.35** | +£0.35 |
| 2. Customer cancels late — deposit retained, no refund | −£10.00 | +£9.45 | **+£0.20** | +£0.35 |
| 2b. Same, full-payment mode: £50 taken, £10 retained, £40 refunded | −£10.00 | +£9.61 | **−£0.56** | +£0.95 |
| 3. Provider cancels — full refund | £0.00 | £0.00 | **−£0.35** | +£0.35 |
| 4. Customer disputes the payment | £0.00 | **+£9.45** | **−£24.80** | +£15.35 |

Scenario 2 is the only one that pays Ceaute anything. Scenario 4 costs Ceaute
248 times its margin on the same booking.

Notes that matter more than the totals:

- **Scenario 2 splits by payment mode.** With a deposit, the commitment amount
  equals the amount paid, so the refund is £0 and no Stripe call happens at all.
  With full payment, the £40 refund is partial — and a partial refund returns
  the application fee *pro rata* while Stripe's processing fee is not returned
  at all. Ceaute crosses into loss at a **37.3% refund on the £10 deposit and a
  51.5% refund on the £50 payment**, both well inside what a late cancellation
  actually refunds.
- **Scenario 3 is indistinguishable from scenario 1 at the Stripe layer.** Both
  produce a `cancellation` refund for the full online amount.
  `booking.cancelled_by` records who cancelled, but the refund operation does
  not carry it, so the refund path cannot currently price a provider
  cancellation differently from a customer one.
- **Scenario 4 is not handled anywhere.** No dispute event is subscribed by
  either webhook route, nothing reverses the transfer, and nobody is notified.
  The provider keeps £9.45 of a booking the customer got back for free.

## Do the current flags produce the intended result?

`buildStripeRefundRequest` sends `reverse_transfer: true` and, now that the fee
is non-zero, `refund_application_fee: true`.

**For the customer, yes.** They are made whole in scenarios 1, 3 and 4, and
keep exactly the agreed retention in scenario 2.

**For the stated business model, no.** The agreed model is that providers bear
responsibility for refunds and chargebacks. These flags do the opposite: they
return the application fee to the provider, so the provider ends at exactly
£0.00 and **Ceaute absorbs Stripe's non-refundable processing fee every time**.

The flags were chosen in [decision 004](../decisions/004-providers-bear-stripe-processing-fees.md)
before provider liability was agreed, on the reasoning that leaving the provider
55p down on a booking they never performed was worse. That reasoning is still
sound; what has changed is that the business model now says otherwise. This is
a conflict between two decisions, not a bug, and it is not mine to resolve.

## Contractual responsibility versus what Stripe can recover

These are not the same thing and the gap is where the exposure lives.

| | Contractually assignable to the provider | Recoverable through Stripe |
| --- | --- | --- |
| Stripe processing fee on a refund | Yes | Yes — `refund_application_fee: false`, automatic |
| Ceaute's 2% on a refunded booking | Yes | Yes — same flag |
| Disputed amount (£10.00) | Yes | Only by a **manual transfer reversal**, which needs funds still in the connected account and **fails once the provider has been paid out** |
| Stripe's £15.00 dispute fee | Yes, in principle | **No.** Stripe's Connect terms state dispute fees may not be passed to connected accounts |

So even a perfectly drafted agreement and a perfectly timed reversal leaves
Ceaute carrying **£15.35** of a disputed £10 deposit. The rest becomes a debt
the provider owes Ceaute, with no mechanism to collect it: there is no set-off
against future payouts, no negative-balance handling, and
`losses_collector: "application"` means Stripe looks to Ceaute, not the
provider, for any shortfall.

A provider agreement can allocate the liability. It cannot create a way to
collect it. Those are separate pieces of work and the second one does not exist.

## The decision required

**Who bears Stripe's non-refundable processing fee when a booking is refunded,
and does the answer depend on who cancelled?**

Three coherent answers. Each is a one-line code change plus the matching
agreement wording; none should be made without the owner choosing.

1. **Ceaute absorbs it (status quo).** Keep both flags. Simple, provider-
   friendly, and Ceaute loses 35p per cancelled deposit plus more on partial
   refunds. Contradicts the agreed model.
2. **The provider bears it always.** Set `refund_application_fee: false`. The
   provider ends 55p down on a cancelled £10 deposit — Stripe's 35p *and*
   Ceaute's 20p commission on a booking that never happened. Matches the agreed
   model but charges commission on nothing.
3. **The provider bears the processing cost only, and only when they caused
   it.** `refund_application_fee: false` plus a separate refund of the 2%
   commission portion through Stripe's application-fee refund endpoint — Stripe
   explicitly sanctions this. Pricing it by cause additionally needs the
   cancelling actor carried through to the refund operation, which
   `booking.cancelled_by` already records but the refund claim does not return.

Option 3 is the one that matches "providers bear refunds" without charging
commission on a cancelled booking. It is the most work and the only one needing
a database change.

**Separately and more urgently: disputes are unhandled.** Whatever is decided
above, before real payments start Ceaute needs, at minimum, to subscribe to
`charge.dispute.created` and tell somebody. That is a product change with a
migration and was deliberately not made here.

## Draft provider-agreement wording — NOT PUBLISHED

Prepared for review only. **Do not paste this into `/terms`.** It states a
liability Ceaute currently has no mechanism to enforce, and clause 2 presumes
option 2 or 3 above has been chosen. Publishing it before that would be
promising a settlement the code does not perform.

> **Refunds, cancellations and disputes**
>
> 1. Where a booking is cancelled and the customer is refunded, the refund is
>    taken from the payment Ceaute processed for that booking. Ceaute reverses
>    the transfer to your Stripe account by the amount refunded.
>
> 2. Stripe does not return its card processing charge when a payment is
>    refunded. That charge is your cost, as it is on the original payment, and
>    it is not returned to you when a booking is cancelled — whoever cancels.
>    [Ceaute's platform fee is returned to you in full on any booking that is
>    refunded. — include only if option 3 is chosen.]
>
> 3. If a customer disputes a payment with their bank, Stripe takes the disputed
>    amount and a fixed dispute fee from Ceaute. You are responsible to Ceaute
>    for the disputed amount on your booking. Ceaute will recover it from your
>    Stripe balance where it can, and will ask you for it directly where it
>    cannot. Ceaute bears the dispute fee itself, because Stripe does not permit
>    it to be passed on.
>
> 4. You agree to give Ceaute the information it needs to respond to a dispute,
>    promptly and accurately. A dispute Ceaute cannot answer is one it loses.
>
> 5. If your Stripe balance is not sufficient to cover an amount you owe under
>    this section, Ceaute may set it off against later payments due to you.
>    [Requires the set-off mechanism to exist. It does not today.]

Clause 5 is the one to think hardest about: without it the liability in clause 3
is unenforceable in practice, and with it Ceaute needs code that withholds from
future payouts, which does not exist and is not trivial under destination
charges.
