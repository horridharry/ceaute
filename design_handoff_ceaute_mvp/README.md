# Handoff: Ceaute MVP UI

## Overview

The full visual and interaction system for Ceaute — a booking platform where independent
UK beauty providers (nail techs, lash techs, brow and hair artists) publish a page and
take paid bookings. This package covers both sides of the product plus everything around
them: customer discovery and booking, the provider dashboard, transactional email, legal
pages and every failure screen.

The design work was done against **this repository's actual source**, not from scratch.
Product rules, route names, payment behaviour and data shapes were read from the code and
from `docs/product.md`, `docs/domain.md` and `docs/architecture.md`. Where a design
deliberately departs from what is currently built, it is listed in
`04-divergences-and-gaps.md` — nothing is silently changed.

**Suggested branch:** `feat/design-system`

## About the design files

The `.dc.html` files in this bundle are **design references**, not production code. They
are static HTML prototypes built to show layout, typography, spacing, colour, copy and
intended behaviour. They use inline styles and contain no application logic.

Your task is to **recreate these designs inside this codebase's existing environment** —
Next.js App Router, React server and client components, Tailwind CSS — using its
established patterns. Do not copy the inline styles across. Translate each documented
value into Tailwind classes (or the theme, where a token repeats), and keep every existing
server action, data loader and validation rule exactly as it is. This is a re-skin plus
some new screens, not a rewrite.

One exception worth stating plainly: the current UI uses `pink-600` / `pink-700` /
`pink-800` from the default Tailwind palette in roughly forty places. The design system
replaces all of them with a single accent, `#8c2b52`. That substitution is the single
largest mechanical change in this handoff.

## Fidelity

**High fidelity.** Colours, type sizes, weights, line heights, letter spacing, radii,
padding and copy are all final and specified. Recreate them exactly. Where a value is not
specified, fall back to the scale in `01-foundations.md` rather than inventing one.

The only low-fidelity parts are explicitly labelled as such: the five template diagrams in
`Ceaute MVP Spec.dc.html` §3 are wireframes showing slot structure, not pixel targets.

## Read these in order

| File | What it covers |
| --- | --- |
| `01-foundations.md` | Colour, type, spacing, radius, motion. Read first — everything else assumes it. |
| `02-components.md` | Every component with states. The build order starts here. |
| `03-screens.md` | Route-by-route: layout, content, behaviour, which template each uses. |
| `04-divergences-and-gaps.md` | Where the designs differ from current code, and what does not exist yet. |
| `05-build-order.md` | Suggested sequence, with the mechanical changes separated from the new work. |
| `06-copy-deck.md` | Every user-facing string, so copy is not retyped from screenshots. |

## Design files in this bundle

| File | Contents |
| --- | --- |
| `Ceaute MVP Spec.dc.html` | **The specification.** Foundations, all components with states, five screen templates, nine routes built from them. This is the source of truth. |
| `Ceaute System Screens.dc.html` | Transactional email (6 booking events + sign-in code), the three checkout bounce-backs, `/auth/error`, not-found, error, `/terms`, `/privacy`, and the root-route decision. |
| `Ceaute Provider Page.dc.html` | The locked public provider page (design 8b), full detail. |
| `Ceaute Booking Prototype.dc.html` | Tappable customer booking path — use for interaction and transition behaviour. |
| `Ceaute Desktop.dc.html` | Desktop breakpoints for provider page, booking and dashboard. |
| `Ceaute App.dc.html` | The full mobile set in one canvas, including states the spec summarises. |
| `Ceaute Signature Moments.dc.html` | The "letter" screens — Confirmed, Published, Cancelled. Reference for voice and typographic scale. |
| `Ceaute Reframes.dc.html` | **Post-launch ideas. Do not build from this file.** Included for context on where the product is heading. |

Open the `.dc.html` files in a browser directly; they need no build step.

## Assets

Portfolio and provider photographs in `uploads/` are real images from the two providers
used as test data (Byuwauk, lashes; Eluxe UK, nails) plus Cluxeklaws. They are **sample
content for the mockups only** — do not commit them as seed data or fixtures. Real
provider images come from the existing Supabase private storage bucket and are served
through short-lived signed URLs, which is already implemented.

No icon set is used. The few glyphs in the designs (chevrons, the star in a rating, a
check inside a checkbox) are text characters or simple CSS shapes. If you introduce an
icon library, keep it to one and match the 1.5px stroke weight implied by the mocks.

## Fonts

Geist (weights 400, 500, 600) for the entire product. No second family, no monospace
anywhere — an earlier iteration used Geist Mono for labels and timers and it was removed
deliberately. Numerals that change in place (countdowns, prices in a live total) use
`font-variant-numeric: tabular-nums`.

Transactional email is the one exception: it must ship the system font stack already in
`src/lib/emails/email-layout.js`, because Geist will not load in Outlook or most desktop
clients. The email mockups are *drawn* in Geist so they read against the rest of the spec.

## Before you start

Read `04-divergences-and-gaps.md`. Several designs describe behaviour the current code does
not have (a treatment-detail sheet, a provider "Today" view, a `[username]/not-found.tsx`),
and a few describe copy the code has wrong (`/auth/error` still refers to a magic link that
no longer exists). Knowing which is which before you open a component will save rework.
