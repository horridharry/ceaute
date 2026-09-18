# 004: Providers bear Stripe's processing cost and Ceaute's platform fee

**Status:** Accepted

## Context

The customer pays the price a provider advertises, and nothing on top. The
provider bears the cost of taking that payment, and Ceaute earns 2% of what it
processes. There are no subscriptions during the private alpha.

Mechanically there is only one lever. Checkout uses a destination charge, so
Stripe creates the transfer to the connected account as part of the charge, and
`application_fee_amount` is the whole amount Stripe holds back from that
transfer and leaves in Ceaute's balance. The connected account is configured
with `fees_collector: "application"`, so Stripe then debits its own processing
fee from that same Ceaute balance. A `application_fee_amount` that only covered
Ceaute's 2% would leave Ceaute paying Stripe out of its own margin, and on a
small booking out of its own pocket.

The complication is that **Stripe's actual fee is not knowable when the split is
set**. `transfer_data` and `application_fee_amount` are fixed when the Checkout
Session is created; the real cost only appears afterwards on the charge's
BalanceTransaction, and it depends on the card the customer happens to present.
UK consumer cards, UK commercial cards and non-UK cards are priced differently.

## Decision

`application_fee_amount` carries both deductions:

```
application fee   = Ceaute's 2% + estimated Stripe processing fee
provider receives = amount charged - application fee
Ceaute keeps      = application fee - Stripe's actual fee
```

The processing component is an **estimate** at Stripe's published UK standard
rate (1.5% + 20p), held as named constants in
`src/lib/payments/booking-payments.js` and injectable, so a rate change is a
parameter rather than a rewrite. Ceaute's 2% is therefore a margin against a
forecast, not a guaranteed net.

Stripe's current UK online rates, which is what makes it a forecast:

| Card | Rate | Cost on a £10 charge |
| --- | --- | --- |
| UK standard (consumer) — **what is estimated** | 1.5% + 20p | 35p |
| EEA | 2.5% + 20p | 45p |
| UK premium (commercial, corporate, business) | 2.8% + 20p | 48p |
| International (non-UK, non-EEA) | 3.15% + 20p | 51.5p |

The spread is about 17p on a £10 booking against a 20p margin, so a single
commercial card very nearly wipes out the margin on that booking.

The fee applies only to money processed through Ceaute. A deposit booking's
offline balance never touches Stripe and is never charged for.

The fee is held **strictly below** the amount charged. Stripe's two guides
disagree — its application-fee guide requires a fee "less than the amount of
the charge" while its destination-charge guide says "capped at" it — so the
stricter reading is taken rather than discovering the answer on a live booking.
On a payment too small to carry both deductions the provider keeps a penny and
Ceaute absorbs the remainder, rather than Checkout creation failing. Stripe's
£0.30 GBP minimum charge puts that path out of reach in practice.

## Consequences

`booking_payment_attempt.ceaute_fee_pence` is the **application fee**, not
Ceaute's margin: it is both components together. Anything reading that column
as revenue is wrong. `calculateBookingFeeSplit` returns the two parts
separately, and provider-facing disclosure uses those rather than the combined
figure, because a provider is entitled to see that the card cost is Stripe's
charge and not Ceaute's.

Ceaute absorbs the variance in both directions. A commercial or non-UK card
costs more than was retained and the difference comes out of the 2%; on a large
enough booking it can exceed the 2% entirely.

## The exposure, and what exact recovery would cost

Exact recovery is not possible within this architecture, because the split is
fixed before the cost is known. The three ways out were considered and **none
was implemented** — each is a change to the payment architecture and needs a
decision of its own:

1. **Separate charges and transfers.** Charge the customer, read the actual fee
   from the BalanceTransaction, then create the transfer for exactly the right
   amount. This makes recovery exact. It replaces the destination-charge flow
   that decision 003 and the PostgreSQL-built Checkout payload are written
   around, and adds a window in which the customer has paid but the provider
   has not been credited.
2. **Estimate high, then refund the excess.** Retain at the worst realistic
   rate (3.15% + 20p), read the real fee from the BalanceTransaction after the
   charge, and refund the over-collection through the application-fee refund
   endpoint. No change to the charge flow, and it works in the direction the
   API actually supports. The cost is that a provider is quoted a net that is
   later revised upward, which is a product and Terms question, not just code.
   Recovering in the other direction — a transfer reversal — is unreliable,
   because it needs funds still in the connected account and fails after
   payout.
3. **Retain at a worst-case rate.** No architecture change and no shortfall
   ever, at the cost of overcharging the common case.

Until one is chosen, the shortfall is real but bounded and the provider is told
plainly, in the Terms and on the payments page, that Ceaute absorbs the
difference rather than passing it on.

### Why the estimate is not simply set high

Over-collection is correctable and under-collection generally is not: Ceaute
can refund part of an application fee at any time, whereas recovering more
needs a transfer reversal, which requires funds still sitting in the connected
account and fails once the provider has been paid out. That asymmetry argues
for estimating at the worst case and refunding the excess afterwards — and that
is the recommended design *if* the correcting refund is built.

It is not built. Estimating high **without** it would simply overcharge every
provider presented with an ordinary UK card, permanently, to insure against a
minority of transactions. So the standard rate is used and Ceaute absorbs the
variance, which is the honest version of the same trade until option 2 below
exists.

### Refunds

**Superseded.** The flags described below were replaced by the canonical
settlement rules in `src/lib/payments/settlement-rules.js`. `reverse_transfer`
still returns the customer's money; `refund_application_fee` is now always
false, and the exact share of the application fee owed back is refunded through
Stripe's application-fee endpoint instead. That is what makes "Ceaute absorbs
the processing cost on an early customer cancellation, the provider bears it on
a late one or a provider cancellation" expressible at all — a boolean can only
return all of the fee or none of it. See
[the refund economics report](../reports/2026-09-18-refund-economics-and-provider-liability.md).

`reverse_transfer: true` with `refund_application_fee: true`, which is what
`buildStripeRefundRequest` already sends once the fee is non-zero, is what the
code does today. Stripe never returns its processing fee on a refund,
so somebody absorbs it, and these flags put it on Ceaute:

| Full refund of the £10 example | Platform | Provider |
| --- | --- | --- |
| `refund_application_fee: true` (current) | **−35p** | £0.00 |
| `refund_application_fee: false` | +20p | **−55p** |

With `false` the provider would end 55p down on a booking they never
performed — Stripe's cost *and* Ceaute's commission — and their connected
balance would go negative, which under `losses_collector: "application"` is
Ceaute's exposure anyway. Ceaute absorbing 35p is the better outcome and
matches what the Terms already promise the customer.

Two consequences to know about:

- **Partial refunds are systematically bad for Ceaute.** The application fee
  comes back pro rata, but the processing fee does not come back at all. Above
  roughly a 36% refund, Ceaute is net negative on the booking. Late
  cancellations refunding the balance above the commitment amount hit this.
- There is a third option Stripe explicitly sanctions: refund with
  `refund_application_fee: false`, then refund only the 2% commission portion
  through the application-fee refund endpoint. That leaves the provider bearing
  exactly Stripe's 35p and nothing more, and Ceaute flat. It is a code change
  to the refund path and was not made here.

### Connect fees the 2% does not cover

Separately from per-transaction processing, Stripe charges the platform **£2
per monthly active connected account** and **0.25% + 10p per payout**. At alpha
volumes these can exceed the 2% outright: a provider taking four £10 deposits a
month generates 80p of platform fee against roughly £2.40 of Connect cost. The
2% is a per-transaction margin, not a whole-business margin, and the pricing
should be revisited against real volume rather than assumed sufficient.

One related exposure is recorded in
[the Stripe Live activation checklist](../stripe-live-activation.md) rather than
here, because it predates this decision: `reverse_transfer` can leave a
paid-out connected account negative.

## Reversibility

Cheap to reverse or re-price. The rates are two constants and the whole
calculation is one module with no stored dependency on the values; historical
bookings keep the fee they were charged, because `ceaute_fee_pence` is written
per payment attempt. Changing the *mechanism* — options 1 and 2 above — is not
cheap, which is why neither was taken here.
