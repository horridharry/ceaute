# 006: Booking terms are a percentage, rounded once in PostgreSQL

**Status:** Accepted (23 September 2026)

## Context

Providers used to set a fixed £ deposit, or a fixed £ amount kept after a late
customer cancellation. A fixed amount means nothing across treatments of
different prices, and a blank retained amount on a full-payment setting kept
£0 while one screen said the whole price was kept. The product owner approved
provider-wide percentage terms: Deposit or Full payment, one percentage, a
cancellation window of 12, 24 or 48 hours.

A percentage of a price in pence is not always a whole number of pence, so the
same booking could be rounded differently by the screen that quotes it, the
hold that stores it and the refund that settles it.

## Decision

- The percentage is 10–100% in steps of 5 (a deposit 10–90%); there is no 0%.
  The same percentage is what a late customer cancellation keeps, and never
  more than was paid. A provider cancellation refunds everything, as before.
- `ceaute.booking_payment_terms(total, mode, percent)` is the only place a
  percentage becomes pence: the percentage of the whole booking price
  (treatment and add-ons), rounded to the nearest penny with halves up, once.
  A deposit is at least £1.00 and never more than the price; treatments cost at
  least £1.00.
- `create_validated_booking_hold` stores the result in the service snapshot
  (`deposit_percent`, `amount_due_now_pence`, and the retained amount in
  `commitment_amount_pence`), so `prepare_booking_cancellation` keeps working
  unchanged. Review and pay asks the same function for its quote
  (`get_public_booking_terms`), the continue action refuses to open Stripe if
  the held amounts differ from what was reviewed, and `claim_booking_checkout`
  refuses an amount that differs from the snapshot. JavaScript only formats
  stored pence (`src/lib/bookings/booking-money.js`).
- Old settings are never converted. A table check (`NOT VALID`, so legacy rows
  stay) accepts only complete percentage terms for new writes. A provider with
  old terms has incomplete terms: a draft cannot publish, and a published page
  stays visible but takes no new bookings until a percentage is chosen
  (`provider_page_accepts_new_bookings`). Nothing is unpublished for them.
- Bookings made before percentages keep their snapshot and the rule they were
  made under, including £0 kept for a blank retained amount.

## Consequences

- Every new snapshot carries the percentage and both amounts; readers must
  still accept older snapshots (`snapshotAmountDueNowPence`,
  `termsFromSnapshot`).
- The worked examples in `supabase/tests/database/percentage_booking_terms.test.sql`
  pin the rounding; `tests/booking-money.test.js` reads the same answers back.
- Providers with old terms are paused until they act; the dashboard says so on
  Today, Booking settings and Publication.

## Reversibility

Low to change the range, step, minimum or rounding for new bookings: one SQL
function and the form. High to reinterpret stored bookings, which would need a
data migration and new refund rules; do not do it.
