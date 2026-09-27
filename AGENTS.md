<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ceaute repository guidance

Start with `README.md`, which maps every document to its one responsibility.
Use `docs/engineering-principles.md` for how to make trade-offs and the change
checklist, `docs/product.md` for current product behaviour, `docs/domain.md`
for terminology, and `docs/architecture.md` for implementation boundaries and
the "Where a change belongs" table, `docs/verification.md` for how
acceptance is run and reported, including local agent runs, and
`docs/rules-and-evidence.md` for which check proves each protected rule.
The ordered files in `supabase/migrations/`
are the final authority for implemented database behaviour; later migrations
may replace earlier functions.

Ceaute is pre-launch and optimises for a working MVP and rapid product
learning, not architectural perfection. Prefer the simplest change that keeps
the journey correct, keep it reversible, and do not refactor working code
unless a product change is blocked by it.

Keep changes within the requested scope. Do not weaken RLS, expose the Supabase
service-role key to the browser, confirm payments from Stripe return URLs, or
move booking, refund, publication, ownership, and private-address invariants out
of PostgreSQL without an explicit architectural decision recorded in
`docs/decisions/`.

Never apply production migrations, promote `main`, or change production
settings without the owner's explicit approval for that step; the path is in
`docs/release.md`. Files in `docs/reports/` are dated snapshots, not current
behaviour: check any claim in them against the code and migrations first.

The `ceaute-*` skills in `.agents/skills/` are Ceaute's own:
`ceaute-product-design` for product and design work, and `ceaute-grill` and
`ceaute-release`, which run only when invoked. For a settled change that spans
layers or touches money, the `ceaute-change` workflow in `.claude/workflows/`
runs it through product, engineering and verification lanes, stopping for
owner decisions and never committing; small fixes do not need it. The rest are
third-party and generic guidance. Where one conflicts with this repository's
documents, decision records or code comments, the repository wins.
Known conflicts:

- `supabase` builds migrations with `supabase db pull`; Ceaute's migrations are
  hand-written and ordered, and the CLI runs as `npx supabase`.
- `stripe-best-practices` says to use the latest Stripe API version;
  `src/lib/stripe/server.js` deliberately pins a preview version.
- `next-best-practices` is a snapshot; the guides in `node_modules/next/dist/docs/`
  win, as above.
