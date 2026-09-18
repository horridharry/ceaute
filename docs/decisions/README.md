# Decision records

Each file records one non-obvious choice that a later reader might mistake for
duplicate work or accidental complexity. The
[engineering principles](../engineering-principles.md) explain when a choice
needs a record: it is hard to reverse, it constrains stored data or external
systems, or it will look wrong without its context.

| Record | Protects | Reversal cost |
| --- | --- | --- |
| [001 PostgreSQL protects booking integrity](001-postgresql-protects-booking-integrity.md) | Overlapping bookings under concurrency and forged input | Low to move more calculation into PostgreSQL; high to remove the exclusion constraint |
| [002 Bookings snapshot the agreement](002-bookings-snapshot-the-agreement.md) | Historical bookings, refunds, and private addresses after provider edits | High: the snapshot shape is stored on every booking |
| [003 Payment work is verified and replay-safe](003-payment-work-is-verified-and-replay-safe.md) | Duplicate charges, refunds, and emails across network boundaries | High: state machines are persisted and Stripe webhooks depend on them |
| [004 Providers bear Stripe processing fees](004-providers-bear-stripe-processing-fees.md) | Ceaute's margin against a processing cost that is unknown when the split is fixed | Low to re-price; high to make recovery exact, which needs a different charge flow |

Format: context, decision, consequences, and a reversibility note. Number the
next record `005`. Keep records short and do not restate product behaviour
that [product.md](../product.md) already describes.
