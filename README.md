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

## Documentation map

Each document has one responsibility. If a fact belongs in two places, link to
it rather than repeating it.

| Document | Answers | Update when |
| --- | --- | --- |
| This README | What Ceaute is, the stack, the URL areas, how to run it | Setup or top-level areas change |
| [Engineering principles](docs/engineering-principles.md) | How we make trade-offs, what counts as necessary complexity, the change checklist | The team agrees a new way of working |
| [Product behaviour](docs/product.md) | What Ceaute does today and the rules a product change must preserve | Observable behaviour changes |
| [Domain model](docs/domain.md) | The vocabulary used in code, routes, and database names | A concept is added or renamed |
| [Architecture](docs/architecture.md) | Where behaviour lives, which boundary is authoritative, where a change belongs | A boundary, integration, or slice changes |
| [Provider agreement (draft)](docs/provider-agreement-draft.md) | What providers accept before taking paid bookings, and the version acceptance is recorded against | The agreement's substance changes — bump the version with it |
| [Dispute response](docs/dispute-response.md) | What happens when a customer disputes a payment, and what a person must do by hand | The dispute flow or its limitations change |
| [Stripe Live activation](docs/stripe-live-activation.md) | What the owner must do to switch Stripe from Test to Live | An activation step is completed or a new one is found |
| [Decisions](docs/decisions/) | Why the few non-obvious choices were made and what reversing them costs | A one-way-door decision is made or revisited |
| [Reports](docs/reports/) | Dated evidence: audits, experiments, readiness reviews | Never edited after the date; write a new one |
| [AGENTS.md](AGENTS.md) | Entry point and guardrails for AI coding agents | Guardrails change |

The ordered files in `supabase/migrations/` are the final authority for
implemented database behaviour; the documents above describe them but do not
replace them.

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

`npm run test:db` needs Docker. When it cannot be run, say so in the pull
request rather than skipping it silently.
