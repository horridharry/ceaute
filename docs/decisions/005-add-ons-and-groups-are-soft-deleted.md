# 005: Add-ons and treatment groups are soft-deleted through PostgreSQL transitions

**Status:** Accepted

## Context

Providers need to remove add-ons and treatment groups they no longer offer, not
only archive them. Both are referenced by data Ceaute must keep: an add-on by
its treatment links and by the add-on choices snapshotted on bookings, a group
by treatments (including archived ones). A hard delete would either cascade
through that history or fail on it, and a delete issued straight from the
browser could skip the "archive first" rule the product asks for.

## Decision

`treatment_add_on` and `treatment_group` gain `deleted_at`, with a check that a
deleted row is inactive. Lifecycle state is written only by
`ceaute.transition_treatment_add_on` and `ceaute.transition_treatment_group`,
security-definer functions that lock the row, check ownership and allow only
Active→Archived, Archived→Active and Archived→Deleted. Column-level grants stop
the authenticated role writing `is_active` or `deleted_at` directly, and row
security hides deleted rows from every provider and customer read. Unique names
apply only to undeleted rows, so a deleted name can be reused.

A group transition fails while any treatment references the group, and a
trigger rejects assigning a treatment to an archived or deleted group, sharing a
lock on the group row so the two cannot race. A published page's last visible
portfolio photo is protected the same way, by a trigger that locks the page row
(migration `202609220003`).

## Consequences

- Deleted rows stay in the tables. A deleted row is always inactive, so any
  reader that already requires `is_active` excludes it; a reader that bypasses
  row security and wants archived rows too must filter `deleted_at is null`.
- A deleted add-on keeps its compatibility rows, so its history stays
  explainable; they are invisible because the add-on is.
- `scripts/db-races/provider-dashboard-races.sh` exercises the seven concurrent
  cases against a disposable database.

## Reversibility

Low to add a purge job later. High to return to hard deletes, which would need a
decision about the history that references these rows.
