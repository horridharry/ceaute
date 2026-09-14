<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ceaute repository guidance

Start with `README.md`. Use `docs/product.md` for current product behaviour,
`docs/domain.md` for terminology, and `docs/architecture.md` for implementation
boundaries. The ordered files in `supabase/migrations/` are the final authority
for implemented database behaviour; later migrations may replace earlier
functions.

Keep changes within the requested scope. Do not weaken RLS, expose the Supabase
service-role key to the browser, confirm payments from Stripe return URLs, or
move booking, refund, publication, ownership, and private-address invariants out
of PostgreSQL without an explicit architectural decision.
