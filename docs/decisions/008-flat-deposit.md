# 008: A deposit can be a flat amount

**Status:** Accepted (27 September 2026), with the product owner in a
`ceaute-grill` session. Revisits
[decision 006](006-percentage-booking-terms.md) for deposits only.

## Context

Decision 006 made booking terms percentage-only, reasoning that a fixed amount
means nothing across treatments of different prices. It cited no provider
evidence. Three days later, the three interviewed providers who take a deposit
all take a flat one: £15, about £10, and "one amount for the whole business"
([report](../reports/2026-09-26-provider-interviews.md), theme 2). For them the
deposit is a fee for holding the time, the same whatever the treatment costs,
and it is the line they post on Instagram. Customers in the demos accepted a
20% deposit, so the problem is on the provider's side, not at checkout.

## Decision

- **A deposit is either a flat £ amount or a percentage.** The provider
  chooses, and flat is the default. One amount applies to the whole business,
  whatever the treatment or add-ons. A flat deposit is whole pounds, at least
  £1.
- **A deposit is never more than the price.** If a booking costs less than the
  flat deposit (an £8 treatment under a £10 deposit), the customer pays the
  whole price now, nothing is due at the appointment, and a late cancellation
  keeps what was paid.
- **A late customer cancellation keeps the whole flat deposit.** An early
  cancellation or any provider cancellation refunds everything, as today.
- **Full payment is unchanged.** It keeps its percentage, which is also what a
  late cancellation keeps.
- **Percentage deposits stay valid.** A provider on a percentage deposit keeps
  it; nothing is converted.
- The hold stores the flat amount in the same snapshot fields as a percentage
  deposit (`amount_due_now_pence` and `commitment_amount_pence`), so
  cancellation and refunds read the same fields whatever the terms were.
  PostgreSQL still works out the amount once, when the hold is made, as
  decision 006 requires.

## Consequences

- `ceaute.booking_payment_terms`, the booking-settings check, the Booking
  settings form, the quote at Review and pay and the terms Ceaute writes out
  learn a second deposit kind. The snapshot keeps a marker of which kind was
  used, and readers accept snapshots without it.
- The pinned examples in
  `supabase/tests/database/percentage_booking_terms.test.sql` and
  `tests/booking-money.test.js` gain flat cases.
- If no pilot provider picks the percentage, retiring it is a later decision.
  The flat default is chosen now, before any live provider depends on it.

## Reversibility

Low for new bookings: one SQL function, one check and the form. Stored bookings
keep their amounts either way, so removing the flat option later would only
affect providers who chose it, who would need to pick a percentage.
