# Ceaute

Ceaute is a marketplace for independent beauty providers. A provider publishes
a public page containing their treatments, portfolio, location area,
availability, and booking terms. A customer can discover that page, choose a
treatment and time, pay through Stripe, manage the booking, and review a
completed appointment.

One signed-in person may use both sides of the product. Creating a provider page
does not create a second account or a separate provider user type.

## Technology

Ceaute is a single Next.js 16 App Router application using React 19, TypeScript
and JavaScript, and Tailwind CSS 4. Supabase supplies email authentication,
PostgreSQL, row-level security, and private image storage. Stripe Connect and
Stripe Checkout handle provider onboarding and booking payments. Resend sends
transactional booking emails.

## Application areas

Public provider pages live at `/@[username]`; discovery lives at `/discover`.
The public booking journey continues below the provider page at
`/@[username]/book/[treatmentId]`.

Signed-in customers manage personal details and bookings under `/account`.
Providers work under `/dashboard`. `/dashboard/onboarding` creates the provider
page and is deliberately accessible before the normal dashboard provider-page
guard applies. Old `/provider/...` URLs are compatibility redirects, not the
canonical route structure.

## Read next

- [Product behaviour](docs/product.md) explains what Ceaute currently does and
  the rules a product change must preserve.
- [Domain model](docs/domain.md) defines the small set of terms used throughout
  the codebase.
- [Architecture](docs/architecture.md) explains the route, Supabase, PostgreSQL,
  Stripe, availability, and orchestration boundaries.
- [Decisions](docs/decisions/) records the few non-obvious choices that should
  not be casually simplified.

## Local development

Use Node.js 22 or newer; `.nvmrc` currently selects Node 22.

```bash
npm ci
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

The Supabase CLI requires Docker for the local stack. Fill `.env.local` with the
local Supabase values and any Stripe, Resend, and cron secrets needed by the flow
you are exercising. Never expose `SUPABASE_SERVICE_ROLE_KEY` to client code.

The normal verification commands are:

```bash
npm test
npm run test:db
npm run typecheck
npm run lint
npm run build
```

Tue 15 Sep - 18:42
