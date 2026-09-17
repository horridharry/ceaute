# 001: PostgreSQL protects booking integrity

**Status:** Accepted

## Context

Available appointment times depend on working hours, blocked dates, minimum
notice, treatment and add-on duration, existing bookings, and live checkout
holds. Two customers can act on the same visible time concurrently. Application
checks alone cannot prevent both requests passing before either writes.

Pre-generating permanent slot rows would duplicate derived state and still
require careful transactional ownership of a slot.

## Decision

Generate useful appointment candidates in application code, then validate the
chosen time again in a narrowly granted PostgreSQL operation. PostgreSQL checks
the current provider, treatment, add-ons, calendar rules, and occupied periods.
A GiST exclusion constraint rejects overlapping active time ranges for the same
provider page.

The awaiting-payment booking is the temporary hold. Expired and cancelled holds
do not participate in the overlap constraint.

## Consequences

The UI remains responsive and can present a calendar without storing every
possible slot. The database remains correct under forged input and concurrent
requests.

Availability logic exists at two layers and must agree. Do not remove the
database validation or exclusion constraint as “duplicate validation.” A later
simplification may centralise more calculation, but it must preserve the
transactional overlap guarantee and the database tests.

## Reversibility

Moving more of the candidate calculation into PostgreSQL, or exposing the
fixed notice, window, and grid rules as provider settings, is a two-way door:
both layers already read the same rules, and the database tests define the
accepted behaviour. Removing the exclusion constraint or the database
re-validation is the one-way door this record exists to protect. This decision
would be wrong only if bookings stopped being exclusive time intervals, for
example group classes with capacity, which would need a new record.
