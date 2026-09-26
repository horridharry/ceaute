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
- Records are never created or edited on production for testing, and dev data
  is not manufactured just to close an acceptance gap. Record the gap instead.
- Agents never sign in with a password or email code. The owner signs in to
  the browser themselves.

## Database tests

Run `npm run test:db` on a freshly reset local database
(`npx supabase db reset`). The pgTAP tests use fixed ids, so they fail with
collisions on a local database that already holds hand-made data.

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
