# Releasing

How a change moves from a feature branch to `https://ceaute.com`, and how
production migrations are applied. The environments themselves are described
in [Stripe Preview testing](stripe-preview-testing.md#recommended-preview-architecture).

## Path

1. Branch from `preview`, commit, and push the feature branch.
2. `git merge --no-ff` the feature branch into `preview`, one merge per branch
   in dependency order, and push. Vercel deploys `https://preview.ceaute.com`
   (`ceaute-dev`, Stripe Test, behind Vercel Deployment Protection).
3. Apply the branch's migrations to `ceaute-dev` and verify on Preview.
4. When the promotion trigger below is met: apply every pending migration to
   `ceaute-prod`.
5. Before fast-forwarding `main`, set the Terms and Privacy `updated` dates to
   the production promotion day.
6. Fast-forward `main` to `preview` (`git merge --ff-only preview`) and push.
   Vercel deploys `https://ceaute.com`. Fast-forward keeps production on
   exactly the commit tested on Preview and keeps the two branches identical.
7. Delete the merged feature branches, locally and on origin.

Migrations always reach a database before the code that reads them, because
new code on an unmigrated database fails (for example, the storefront selects
`display_photo_path`). Migration `202609270001` drops the old availability
tables outright, so Preview storefronts error between applying it and the new
deploy finishing.

## When to promote to production

Production is deliberately left behind `preview` until the first of these
happens:

- the first real provider is invited to set up a page;
- the first private-alpha invitation is sent;
- Stripe is switched to Live (see [Stripe Live activation](stripe-live-activation.md)).

Promote before that event, not after it. Until then, do not promote
piecemeal.

## Before the first alpha invitation

The one list of what is still unverified or unfinished before the first
private-alpha invitation. Delete an item when it closes; mark it
**accepted risk** if the owner decides not to verify it. How items are
verified and reported is in [Verification](verification.md).

- Owner: a real-keyboard pass across all new screens (unverified).
- Accepted risk for the pilot: the full provider agreement is not shown
  before acceptance (see [Pilot](pilot.md#legal-during-the-pilot)).
- Owner: tell any pilot provider that their weekly hours and blocked dates
  are deleted when drops ship.
- Flat deposit on Preview: a provider cancellation of a flat-deposit booking,
  and the setup, pause and pre-006 notice wording. The late customer
  cancellation passed on 30 September
  ([results](reports/2026-09-30-preview-acceptance-drops-and-flat-deposit.md)).
- Needs the owner signed in: the provider Portfolio viewer (acceptance was
  waived), the owner storefront preview, add-on cards and the Archive button
  with real data, and the form save and submit paths.
- No test account exists yet: the unpublished-provider states (View your page,
  storefront 404).
- Production only, after promotion: the published storefront and provider
  metadata (production has no providers yet).

## Production migrations

The repository stays linked to `ceaute-dev`; never re-link it to
`ceaute-prod`.

1. List what production lacks:
   `git diff --name-only main..preview -- supabase/migrations`.
2. The owner exports the `ceaute-prod` **Session pooler** connection string
   (Supabase dashboard; the Direct connection is IPv6-only) as `PROD_DB_URL`
   in their own terminal. The string is never pasted into an agent chat.
3. In that terminal: `npx supabase db push --db-url "$PROD_DB_URL" --dry-run`,
   check the list matches step 1, then run it again without `--dry-run`.
4. Confirm with `npx supabase migration list --db-url "$PROD_DB_URL"`.

## Checking production

Production has no test data, and records are not created or edited there for
testing. After a promotion, smoke-test signed out on `https://ceaute.com`
(Discover, a missing storefront returns 404, legal pages). Anything that needs
a published provider or a payment is recorded as not verified on production
until real use covers it.

## Rules for agents

- Every production step (migration, promotion to `main`, production
  environment variables) needs the owner's explicit approval for that step.
- The owner applies migrations to both `ceaute-dev` and `ceaute-prod`, from
  their own terminal, dry run first. Agents never run `db push` and never
  handle a connection string. Before pushing code that needs a migration,
  confirm it is applied with `npx supabase migration list`.
- `main` only ever fast-forwards to `preview`. If `--ff-only` refuses, `main`
  has a commit `preview` lacks: stop and ask rather than creating a merge
  commit.
- Stage explicit paths when committing, never a whole directory.
