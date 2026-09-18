# Provider agreement — DRAFT, version 2026-09-18

**For owner and legal review. Not legally approved.** No solicitor has read
this. It is published to providers inside the product as the agreement they
accept before taking paid bookings, so the sooner it is reviewed the better —
but it must not be described as legally approved until it has been.

The version string above is the one recorded in
`ceaute.provider_agreement_acceptance` and held in
`PROVIDER_AGREEMENT_VERSION`. **Changing the substance below means bumping the
version**, which makes every existing acceptance stale and re-gates paid
bookings until each provider accepts again. Fixing a typo does not.

Every clause below describes behaviour that is implemented and tested. Where
something is a manual process, it says so rather than implying automation that
does not exist.

---

## 1. What this covers

You are an independent business. Ceaute provides the page customers find you
on, takes payment for bookings, and passes the money to you. The agreement to
carry out a treatment is between you and your customer.

## 2. What you are paid

The customer pays the price you advertise. Two amounts come out of every
payment Ceaute processes for you:

- **Stripe's card processing charge.** Stripe's cost, not Ceaute's, and not
  money Ceaute keeps. Stripe's published UK rate is currently 1.5% + 20p; cards
  issued outside the UK or to a business cost more. The amount deducted is
  Stripe's published rate rather than a figure worked out per card, because the
  real cost is only known after the payment completes. Where the real cost is
  higher, Ceaute absorbs the difference rather than passing it to you.
- **Ceaute's platform fee of 2%** of the amount processed.

You receive the rest. Both apply only to money taken through Ceaute: where you
take a deposit, the balance your customer pays you in person is yours in full.
There is no subscription, listing fee or monthly cost.

## 3. If a booking is refunded

Stripe does not return its processing charge when a payment is refunded, so
somebody bears it.

- **A customer cancels inside your cancellation window.** They are refunded in
  full. You receive nothing and you pay nothing: Ceaute returns its platform
  fee and absorbs Stripe's charge. It costs you £0.
- **A customer cancels after your window.** Your cancellation policy decides
  what you keep. Ceaute's 2% is then charged on **the amount you actually
  keep**, not on the original payment, and any platform fee collected above
  that is returned to you. Stripe's charge on the original payment is not
  returned by Stripe to anyone and remains your cost.
- **You cancel a confirmed booking.** The customer is refunded in full and
  Ceaute returns its platform fee. Because the cancellation was yours,
  Stripe's charge on the original payment is your cost.

## 4. If a customer disputes a payment

A dispute is a customer asking their bank to reverse a payment. Ceaute records
every dispute, responds to it, and will ask you for the information needed to
answer it — usually whether the appointment happened. **Answer promptly: a
dispute nobody answers is lost by default, and the deadline is set by the card
network, not by Ceaute.**

- **If the dispute is won**, nothing changes. The booking keeps its normal
  economics.
- **If the dispute is lost and the booking was your responsibility**, the
  reversed payment amount is yours to bear, and Ceaute returns its platform fee
  because the payment was reversed.
- **If the dispute was caused by a Ceaute error** — a duplicate charge, a wrong
  amount, or a fault in Ceaute's payment system — Ceaute bears the whole cost
  and you bear nothing.

**Stripe's dispute fee is not yours.** Stripe charges a fixed fee for every
dispute and its Connect terms do not permit passing it to your account. Ceaute
carries it. The same applies to any other Stripe cost that cannot lawfully or
technically be passed on.

## 5. How an amount you owe is collected

Where an amount under clause 4 is yours to bear, Ceaute will first take it back
from the funds still held in your Stripe account for that booking. Stripe can
only reach money that is still there: **once a payout has reached your bank,
Stripe cannot take it back**, and Ceaute does not debit your bank account.

Anything Ceaute cannot recover that way is recorded as an outstanding balance
on your account, and **Ceaute will ask you for it directly**. Ceaute does not
withhold it from your future payouts automatically.

## 6. Outstanding balances pause new bookings

While you have an outstanding balance under clause 5, **your page cannot take
new paid bookings**. Existing confirmed bookings are unaffected and you should
carry them out as normal. Bookings resume when the balance is settled.

This is not a penalty. It exists so an unpaid balance cannot grow while it is
unresolved.

## 7. Your responsibilities

You are responsible for your own qualifications, training, licences,
registrations, insurance, health and safety, and tax, and for the standard of
every treatment you carry out. Keep your treatments, prices, availability,
location and booking terms accurate, honour bookings you have accepted, and
cancel as early as you can when you cannot.

Customer contact details you receive through Ceaute are for delivering that
customer's appointment. You become responsible for that information under data
protection law once you hold it.

## 8. Accepting this agreement

You accept a specific version, and the acceptance is recorded with the date and
cannot be altered afterwards. If Ceaute changes the substance of this
agreement, you will be asked to accept the new version before taking further
paid bookings.

---

## Reviewer notes — not part of the agreement

Three things a reviewer should look at first:

1. **Clause 5 describes a manual process, deliberately.** Ceaute can reverse a
   Stripe transfer while funds remain in the connected account and does so on
   an operator's instruction, not automatically. There is no set-off against
   future payouts and no bank debit. The clause says so rather than claiming a
   recovery power Ceaute does not have.
2. **Clause 6 is the substitute for collections infrastructure.** It is the
   smallest control that stops exposure growing, and it is enforced in code at
   the point a paid booking would be created.
3. **Clause 4's split follows the settled liability policy** in
   [decision 004](decisions/004-providers-bear-stripe-processing-fees.md) and
   [the refund economics report](reports/2026-09-18-refund-economics-and-provider-liability.md).
   The exclusion of Stripe's dispute fee is not a drafting choice: Stripe's
   Connect terms forbid passing it on, and the ledger refuses to record it as
   provider debt.

Unresolved, and recorded rather than drafted around: Ceaute still has no
mechanism to compel payment of an outstanding balance beyond pausing bookings
and asking. For private alpha, with a small invited group, that is the accepted
position.
