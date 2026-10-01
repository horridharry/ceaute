# Independent review and planted defects — proposal, 28 September 2026

Status: **approved by the owner on 28 September 2026 (both parts, all 13 defects); to be built once the two payment-bug fixes have finished.** This is step 4 of
the [agent development plan](2026-09-28-ai-development-plan.md).

Step 4 answers one question: **would our checks catch the mistakes we
actually fear?** It has two parts. Part A plants known bugs on a throwaway
copy and records which check fails. Part B changes how `ceaute-change`
reviews a money change.

## Part A: planted defects

Each defect is a small, plausible mistake in one protection. It is applied
to a throwaway copy of the code, then every check is run: `npm test`,
`npm run test:db` on a fresh database, and `npm run local:sequences`. A
defect is **caught** if at least one check fails. A defect nothing catches
is a blind spot, and it gets a new check.

The "should be caught by" column is written **before** running anything. A
wrong prediction is itself a finding: it means our picture of the checks is
wrong.

| # | Planted defect (where) | What would go wrong for real | Should be caught by | Prediction |
| --- | --- | --- | --- | --- |
| P1 | Drop the overlap rule `booking_no_active_overlap` (migration) | Two customers booked into the same time | `test:db` overlap tests; race script B1 | Caught by `test:db`; no sequence notices |
| P2 | `claim_stripe_payment_event` processes an event again even after it completed | A repeated Stripe message is handled twice | `test:db` "A completed payment webhook replay is idempotent" | Caught by `test:db`. S2 probably still passes, because payment completion has its own second guard |
| P3 | The payments webhook accepts an event with a bad signature (`constructEvent` in `src/app/api/stripe/payments/route.ts`) | Anyone could fake "paid" and confirm a booking | Nothing today | **Not caught**: a known gap in [rules and evidence](../rules-and-evidence.md) |
| P4 | `complete_booking_payment_attempt` stops comparing the amount paid with the amount due | A £1 payment confirms a £15 booking | `test:db` "A mismatched authoritative amount is rejected" | Caught by `test:db` only |
| P5 | A provider cancellation after the deadline keeps the deposit (`prepare_booking_cancellation` applies the late rule to providers) | Casey loses £15 when Pat cancels | `test:db` "A provider cancellation refunds everything, even inside the window" | Caught by `test:db`. S1-late only when Pat happens to win, because S1 does not control who is first |
| P6 | A late customer cancellation keeps everything paid, not the agreed share | On full payment with a 30% late-cancellation share, Pat keeps 100% | `test:db` "Late cancellation of a full payment keeps 30% and refunds the rest" | Caught by `test:db`. No sequence notices: the seed's £15 deposit is the whole payment, so both rules keep £15 |
| P7 | Payment completion ignores that the hold has run out (`expires_at > now()`) | A late payment becomes a booking over someone else's | `test:db` "A payment after hold expiry is routed to refund rather than confirmation" | Caught by `test:db`. S3 probably not: Jo's hold has already cancelled Casey's, so the late-payment path is taken anyway |
| P8 | A retried refund uses a new idempotency key (`src/lib/payments/refunds.js`) | A refund retried after a timeout is paid twice | Unit test "a refund interrupted by a Stripe outage is recovered later with its original idempotency key" | Caught by `npm test` only |
| P9 | The hold summary includes the postcode for an unpaid hold (`get_booking_hold_summary`) | The exact address is shown before payment | `test:db` "An expired unpaid customer hold has no postcode in its detail summary" | Caught by `test:db` |
| P10 | The `provider_location_select_own_provider` policy lets any provider read every location | One provider reads another's private addresses | `test:db` "A provider cannot read another provider" | Caught by `test:db` |
| P11 | A client component imports the service-role client | The database master key is sent to browsers | The import-boundary unit test and `server-only` at build (added 28 September) | Caught by `npm test` and `npm run build` |
| P12 | Booking emails lose their "once per booking, event and recipient" key | Customers get the same email twice | `test:db` "Cancellation enqueues one email per recipient exactly once"; S2 "no new emails" | Caught by `test:db`; S2 may also catch it |
| P13 | A refund sends Stripe the whole amount charged, not the amount due back (`src/lib/payments/refund-request.js`) | A late cancellation of a full payment refunds everything | `tests/refund-request.test.js` | Caught by `npm test` (the test checks the amount sent); no sequence covers partial refunds |

### How it runs

- A script (`npm run local:defects -- P5`) makes a throwaway worktree, applies
  one defect, runs the checks and prints **caught by …** or **NOT CAUGHT**.
  It then deletes the worktree. A defect never reaches a branch.
- Database defects are added as one extra migration on the throwaway copy.
  Code defects are one-line edits.
- The runs use a **second local Supabase stack** of their own (different
  project id and ports), so they never reset the shared stack another
  session is using. The shared-stack clash on 28 September would otherwise
  repeat. A full pass of all 13 takes about 90 minutes of machine time and
  none of yours.
- Results go into this report as a table: predicted, actual, and the new
  check added for each blind spot.

## Part B: an independent review for money changes

What `ceaute-change` does today (`.claude/workflows/ceaute-change.js`, Verify):

- Two reviewers read the diff **together with the brief and the full plan**,
  so they see the author's reasoning before judging the code.
- Each serious finding goes to a second agent told to disprove it, and to
  **dismiss it when it cannot confirm it**. Dismissed findings are listed
  but never sent back for fixing.
- Verify never runs `test:db` or the local sequences.

Proposed, for changes the plan marks as protected (money, database,
RLS, email):

1. **A reviewer that sees only the requirement.** A third reviewer gets the
   brief's "changes" and "preserve" lines, the matching rows of
   [rules and evidence](../rules-and-evidence.md) and the diff. It does
   not get the plan or any explanation. It must return each problem as a
   **reproduction**: exact steps (a SQL script on the local stack, a
   `local:sequences` run or a failing unit test), plus what should happen and
   what does.
2. **Findings are checked by running them, not by argument.** The second
   agent runs the reproduction. If it reproduces, the finding is real. If it
   cannot be run (for example, it needs a browser), the finding is shown to
   the owner as **unverified**, never dismissed.
3. **Planted defects for the touched area.** After a protected change passes,
   the Part A defects that target the functions it touched are run again. This
   proves the new code is still guarded; it catches a change that silently
   weakens a check.

Cost: about a day for the defect script and its 13 defects, and half a day
for the workflow change. A protected change's review then takes longer,
roughly 20–40 extra minutes of machine time.

## Decisions (owner, 28 September 2026)

1. The list of 13 defects is approved as written.
2. Changing `ceaute-change` as in Part B is approved.

When to run: after the two payment-bug fixes now in progress have finished.
They change the payment functions that several defects target, and they are
using the shared local stack now.
