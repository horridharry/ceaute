# Preview signed-out smoke test, 28 September 2026

Closes the agent item "run the deployed smoke tests on Preview that were
blocked by the login wall" in [Releasing](../release.md#before-the-first-alpha-invitation).
Run with `vercel curl --deployment https://preview.ceaute.com` against
`preview` at 97a0b76, signed out of Ceaute.

| Page | Result | Seen |
| --- | --- | --- |
| `/discover` | Verified | 200; lists the one published test provider (Cluxeklaws, Stratford) |
| `/terms`, `/privacy` | Verified | 200 |
| `/@cluxeklaws` | Verified | 200; Treatments, Portfolio and Availability ("28 September – 3 October slots are open for booking") |
| `/@cluxeklaws/treatments` | Verified | 200; treatments grouped by category |
| `/@cluxeklaws/photos` (gallery) | Verified | 200; 6 photos |
| `/@cluxeklaws/reviews` | Verified | 200; "No reviews yet." |
| `/@cluxeklaws/book/<treatment>` and `/time` | Verified | 200; "Choose add-ons", then "When suits you?" with 09:00–12:30 slots |
| `/@no-such-provider-xyz` | Verified | 404 |

Not applicable any more: "closure" (blocked dates were removed with drops,
[decision 007](../decisions/007-availability-released-in-drops.md)) and the design-system pages (no such route
exists in `src/app`).

Environment variables: `vercel env ls` shows the same 13 names in Preview and
Production. Values were not read. Preview running Stripe Test mode is shown by
the test-card payments in the
[flat deposit acceptance](2026-09-27-flat-deposit-preview-acceptance.md).
