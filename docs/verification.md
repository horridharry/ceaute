# Verification

How a change is checked beyond the automated tests, and how the result is
reported. Which commands must pass before a change is merged is in the
[change checklist](engineering-principles.md#checklist-for-a-change); what is
still unverified before the first alpha invitation is in
[Releasing](release.md#before-the-first-alpha-invitation).

## Reporting results

- Every acceptance item is **verified** (exercised and seen to work),
  **unverified** (not exercised), or **waived** (the owner decided not to
  verify it, recorded as an accepted risk). Waived or unverified work is never
  described as passed.
- Keyboard activation is verified by the owner with a real keyboard. Agent
  browser tools cannot trigger the default action of Enter, Space or Escape,
  so keyboard activation stays unverified until the owner reports it.
- Records are never created or edited on production for testing, and
  `ceaute-dev` data is not manufactured just to close an acceptance gap.
  Record the gap instead. The local stack is disposable and is seeded on
  purpose (see [Local agent runs](#local-agent-runs)).
- On Preview and production, agents never sign in; the owner signs in to the
  browser themselves. On the local stack, agents sign in to the seeded
  `@ceaute.test` accounts with `npm run local:sign-in` (decided by the owner on
  28 September 2026). Never with a password, an email code or a real person's
  account.
- A booking or payment step is verified by the records it leaves, not by the
  screen that follows it. On the local stack that is `npm run local:timeline`
  with its checks agreeing; a confirmation page alone is unverified.

## Database tests

Run `npm run test:db` on a freshly reset local database
(`npx supabase db reset`). The pgTAP tests use fixed ids, so they fail with
collisions on a local database that already holds hand-made data.

## Local agent runs

The local stack lets an agent run a whole journey without the owner: publish,
book, pay, cancel and refund, then read the result from the database and from
Stripe. Everything in `scripts/local/` refuses to run unless Supabase is the
local stack, so none of it can reach `ceaute-dev` or production.

| Command | What it does |
| --- | --- |
| `npx supabase db reset && npm run local:seed` | A clean database with `provider@ceaute.test` (page `@local.nails`, draft, ready to publish once payments are set up) and two customers, `customer@ceaute.test` (Casey) and `jo@ceaute.test` |
| `npm run local:start` (or preview_start `ceaute-local`) | Builds and serves the app on `http://localhost:3100` against the local stack and the local Stripe sandbox, with Stripe events forwarded by the Stripe CLI. `-- --no-build` reuses the last build; `-- --no-stripe` runs without a sandbox key, so payments fail |
| `npm run local:sign-in -- provider [path]` | Prints a one-time sign-in link for a seeded account (`provider`, `customer` or any `@ceaute.test` user); open it in the browser pane |
| `npm run local:timeline -- latest [--stripe]` | One booking's history in time order and checks that its records agree; `--stripe` also compares amounts with the Stripe sandbox. Exits 1 on a disagreement |
| `npm run local:sequences [-- S3 S6]` | Resets and seeds the local database, then plays the event-order sequences in [the sequences report](reports/2026-09-28-event-order-sequences.md) against the running app and the Stripe sandbox. Exits 1 if any check fails |

One-time setup by the owner:

1. Create a Stripe test sandbox used only for local runs, never the sandbox
   Preview uses, so local Checkout events never reach Preview's webhook.
2. Put its test secret key in `.env.localstack` (gitignored) as
   `STRIPE_SECRET_KEY=sk_test_…`.
3. Start the app, sign in as the provider, set up payments on Settings →
   Payments and finish Stripe's test onboarding in the browser.
4. Run `npm run local:seed -- --remember-stripe-account`. Every later seed then
   starts with payments ready.

What a local run does not cover: emails are queued in the outbox but not sent
(the Resend key is a placeholder), Supabase Cron does not call the app, and
Preview's own configuration (domains, protection, webhook destinations) is not
exercised. Keyboard activation still needs the owner. `npm run test:db` needs
a reset without the seed, so reset again before running it.

The local stack is shared by every session on this machine. Run the
sequences, a seed or a reset from one session at a time: a session that
changes the test provider mid-run makes another session's checks fail for
reasons that are not Ceaute's (this happened on 28 September 2026).
`local:sequences` stops when the test provider stops taking bookings
outside the run.

## Browser acceptance on this machine

Accept against a production build, not `next dev`: agent browser panes
reload-loop against the development server.

```bash
npm run build
npx next start -p 3100
```

To compare before and after a change, build the earlier commit beside it:

1. `git worktree add --detach <scratch>/baseline <sha>`.
2. Copy `node_modules` with `cp -Rc node_modules <scratch>/baseline/`.
   Turbopack rejects a symlinked `node_modules`.
3. Copy `.env.local` into the worktree.
4. In the worktree, `npm run build` and `npx next start -p 3200`.

Cookies on `localhost` are shared across ports, so one sign-in covers both
builds. Remove the worktree with `git worktree remove` afterwards.

## Checks against Preview

- `https://preview.ceaute.com` is behind Vercel Deployment Protection, so a
  browser lands on the Vercel login. Agents do not sign in to Vercel; use
  `vercel curl` for deployed checks and `vercel env ls` for environment
  variables.
- A Supabase Cron request that reaches the protection wall still gets HTTP 200,
  with the Vercel SSO page as the body. Judge a cron tick by the response body
  or the `x-matched-path` header, not the status.
- On `ceaute-dev`, the `cluxeklaws` test provider sometimes hides and re-shows
  photos. A lower photo count there is usually that, not data loss.

What to check on production after a promotion is in
[Releasing](release.md#checking-production).
