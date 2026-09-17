# 002: Bookings snapshot the agreement

**Status:** Accepted

## Context

Providers can change their public name, treatment description, price, duration,
address, payment terms, cancellation window, and written policy. A historical
booking must continue to explain what the customer selected and what both sides
agreed to at checkout.

Resolving all booking screens and refund rules through current provider records
would silently rewrite history. Keeping private address data only on the current
location would also make disclosure depend on later edits.

## Decision

At hold creation, store the customer contact details and the complete selected
service contract as JSON snapshots on the booking. The service snapshot includes
provider and treatment identity, add-ons, timing, money, public and private
location, and cancellation terms.

Booking detail, cancellation, refund, and email behavior use these snapshots.
The booking may retain foreign keys to current records for identity and
ownership, but those records do not replace the historical values.

PostgreSQL functions return redacted or full snapshots according to booking
state and caller. Private address details are available only for paid confirmed
or completed booking detail and confirmation messages.

## Consequences

Some data is intentionally duplicated. Snapshot shape is a long-lived contract,
so additions and consumers need compatibility tests. Do not normalise snapshots
away, recalculate old refunds from current settings, or rely only on component
filtering for private-address disclosure.

## Reversibility

Adding a field to a snapshot is cheap and backwards compatible; consumers
already tolerate older shapes (see `tests/booking-display.test.js`). Renaming
or removing a field, or replacing snapshots with joins to current records, is
a one-way door because every stored booking carries the current shape and the
refund and redaction functions read it. Reversal would need a data migration
over historical bookings and new database tests. This decision would be wrong
only if providers could no longer edit terms after a booking exists.
