# Responding to a failed refund

This document answers: **Stripe could not return a customer's refund — what
does Ceaute do, and what must a person do by hand?**

A card refund can fail after Stripe first reported it as refunded: the
customer's bank sends the money back, most often because the card has expired
or been cancelled. Stripe says this can happen up to 30 days later, and that
the business must then "arrange an alternative way" to refund the customer.
Ceaute records the failure and tells the operator. Paying the customer is done
by a person.

## What the product does on its own

1. Stripe sends `refund.failed` (with `failure_reason`, for example
   `expired_or_canceled_card`) to `POST /api/stripe/payments`.
2. `record_booking_refund_state` marks the refund operation `failed` (or
   `cancelled`) and the payment `refund_failed`, even if the refund had
   reported `succeeded` first. An older Stripe event than the last one
   recorded is still ignored.
3. The customer's booking page says "We couldn't refund £X automatically.
   Email help@… and we'll put it right." The provider's booking page says
   the automatic refund failed. **The customer is not emailed** (owner
   decision, 28 September 2026): the operator contacts them.
4. One email, "Action needed: a refund didn't reach the customer", is queued
   to the operator (`CEAUTE_OPERATOR_EMAIL`, falling back to the published
   contact address) and sent straight away. It gives the amount owed,
   Stripe's reason, the Stripe refund and payment ids and the booking, but no
   customer contact details or address.

Nothing is retried. The same idempotency key returns the same failed refund,
and a new refund to the same card would fail again.

## Where the money is

Checked in the Stripe sandbox on 28 September 2026 (`local:sequences` S6):

- Stripe puts the refunded amount back in **Ceaute's platform balance**, as a
  `refund_failure` balance transaction. The charge then shows nothing
  refunded.
- The transfer reversal that took the money back from the provider **stays**,
  and so does any share of Ceaute's fee already handed back to the provider.
  The provider is left exactly where the settlement rules put them, so they
  owe nothing and are not contacted.

So Ceaute holds the customer's money and owes it to them.

## The manual procedure

1. **Read the alert email.** Note the amount, the Stripe payment id and the
   booking id.
2. **Find the customer's contact details** from the booking. They are in the
   booking's customer snapshot in the Supabase dashboard (table
   `ceaute.booking`, column `customer_snapshot`), or on the payment in the
   Stripe Dashboard.
3. **Email the customer yourself.** Say the refund to their card was returned
   by their bank, and ask how they would like it paid (for example a bank
   transfer to an account in their name).
4. **Pay them outside Stripe**, from Ceaute's own account, for exactly the
   amount in the alert.
5. **Do not create a new refund in the Stripe Dashboard.** The provider's
   share has already been taken back, a new refund with "reverse transfer"
   would take it twice, and Ceaute's webhook would reject a refund it did not
   create.
6. **Watch for a dispute.** The charge shows nothing refunded, so the
   customer could still dispute it with their bank. If they do after being
   paid, answer it with the transfer receipt as evidence (see
   [the dispute runbook](dispute-response.md)).

## Known limitations

- **Nothing records that the customer was paid.** The booking keeps saying
  the refund failed. Keep the transfer receipt with the alert email.
- **One alert per booking.** A second failed refund on the same booking would
  not re-alert; a booking has one refund almost always.
- **Only failures Stripe reports are alerted.** A refund Ceaute could not
  create at all (for example a revoked Stripe key) is marked failed or sent
  to review without an email; see the recovery notes in
  [the refund recovery report](reports/2026-09-17-email-otp-and-refund-recovery.md).
