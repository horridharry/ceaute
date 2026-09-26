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
   `ceaute-prod`, then fast-forward `main` to `preview`
   (`git merge --ff-only preview`) and push. Vercel deploys
   `https://ceaute.com`. Fast-forward keeps production on exactly the commit
   tested on Preview and keeps the two branches identical.
5. Delete the merged feature branches, locally and on origin.

Migrations always reach a database before the code that reads them, because
new code on an unmigrated database fails (for example, the storefront selects
`display_photo_path`).

## When to promote to production

Production is deliberately left behind `preview` until the first of these
happens:

- the first real provider is invited to set up a page;
- the first private-alpha invitation is sent;
- Stripe is switched to Live (see [Stripe Live activation](stripe-live-activation.md)).

Promote before that event, not after it. Until then, do not promote
piecemeal.

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
- `main` only ever fast-forwards to `preview`. If `--ff-only` refuses, `main`
  has a commit `preview` lacks: stop and ask rather than creating a merge
  commit.
- Stage explicit paths when committing, never a whole directory.
