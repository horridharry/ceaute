---
name: ceaute-product-design
description: Product and interaction design rules for Ceaute. Use when designing, reviewing, changing, or implementing Ceaute user experiences, screens, navigation, flows, information architecture, or visible product behaviour.
---

# Ceaute Product Design

This skill defines how to reason about product and interface decisions for Ceaute.

Ceaute is a mobile-first UK booking and discovery platform for independent beauty providers.

This skill is the product authority for design work.

Generic frontend, UI, accessibility, or web-design guidance may improve the execution of an approved Ceaute design, but must not override Ceaute product intent.

## Core operating rule

> Absence of a product decision is not permission to infer one.

Do not derive product structure from:

- database relationships
- route structure
- source-code organisation
- shared components
- the current UI
- technical convenience
- conventional SaaS patterns
- another Ceaute section that happens to look similar

Implementation describes how the application currently works. It does not automatically define how the product should work.

When a product decision is missing, mark it:

`UNDECIDED`

You may propose a small number of clearly labelled alternatives with their trade-offs.

Do not silently choose one.

## Authority

For product/design work, use this priority:

1. Explicit current product direction from the product owner
2. Documents referenced by this skill
3. Approved task-specific specification
4. Existing implementation
5. Generic design conventions

When the implementation conflicts with an approved product decision, preserve the product decision and identify the implementation mismatch separately.

Do not redesign the product around legacy implementation merely to reduce engineering work.

## Product philosophy

Ceaute should feel easy rather than clever.

Providers should think in terms of their business:

- treatments
- availability
- bookings
- customers
- locations
- payments

They should not have to understand Ceaute's database or internal architecture.

Prefer obvious behaviour over novel interaction.

Prefer progressive disclosure over presenting every available control simultaneously.

Show enough information for the user to understand and act, then reveal additional depth when requested.

Complex business rules do not require complicated interfaces.

Expose the decision the user needs to make, not the machinery Ceaute uses to execute it.

## Independent product sections

Provider management areas are independent product sections:

- Home / Today
- Bookings
- Treatments
- Treatment Groups
- Add-ons
- Locations
- Availability
- Profile
- Portfolio
- Payments
- Booking Settings

Do not invent an umbrella product concept around sections because their data is related.

In particular:

**Do not call Treatments, Treatment Groups and Add-ons a Catalogue or Catalog.**

Do not invent a replacement umbrella term unless explicitly approved.

Independence does not prohibit contextual interaction.

For example, a Treatment can allow the provider to create a Treatment Group while creating the Treatment.

That does not make Treatment Groups merely a subsection of Treatments.

## Do not force symmetry

Different areas may need different interfaces.

Examples:

- Treatments may need search and Treatment Group filtering.
- Add-ons do not currently need search or filtering.
- Availability can use expandable weekday rows.
- Treatments can use bounded cards.
- Discovery providers should not automatically be enclosed in cards.

Do not add UI simply to make sections structurally consistent.

Consistency should primarily come from interaction quality, typography, spacing, controls, language and visual hierarchy.

## Mobile first

Design the mobile experience first.

Mobile is not a reduced desktop version.

Navigation, touch targets, content hierarchy and disclosure should work naturally on a phone before adapting to larger screens.

Provider navigation uses a menu accessible from the top-level interface alongside the profile control.

Exact navigation ordering/grouping is not defined unless specified elsewhere.

Do not infer hierarchy from implementation or data relationships.

## Read before designing

For provider work, read:

`references/provider-experience.md`

For customer-facing or booking work, read:

`references/customer-experience.md`

For visual/interface decisions, read:

`references/visual-language.md`

For broader reasoning, read:

`references/product-principles.md`

Before resolving an unspecified decision, check:

`references/undecided.md`

Do not load unrelated reference material merely because it exists.

## Design workflow

Before implementation:

1. Identify the user and journey.
2. Read the relevant Ceaute references.
3. Separate what is:
   - APPROVED
   - MVP CHOICE
   - UNDECIDED
4. Determine whether the requested work requires a new product decision.
5. If it does, stop before implementation and present a small number of proposals.
6. Explain meaningful trade-offs in product language.
7. Obtain product approval.
8. Produce an implementation-ready design/specification.
9. Only then implement.

When an approved specification already resolves the relevant decisions, do not repeatedly ask for approval of ordinary engineering details.

## Using other design skills

The Ceaute product model comes first.

A generic frontend-design skill may determine how to execute the approved direction beautifully.

A web-design/accessibility skill may identify usability, accessibility and implementation-quality problems.

When either runs on Ceaute, the repository's `docs/design-system.md` and the references in this skill are the brief. Neither proposes new palettes, typefaces, copy rules or navigation patterns; where their guidance conflicts with those documents, the Ceaute documents win.

Neither may:

- invent Ceaute features
- restructure Ceaute's product model
- introduce generic dashboard patterns
- change booking/payment semantics
- add speculative sections
- override explicit Ceaute decisions

Think of the hierarchy as:

Product intent
→ Ceaute product design
→ frontend design execution
→ implementation
→ UI/accessibility QA

## Existing UI

Never assume the existing interface is approved merely because it exists.

Before preserving an existing pattern, determine whether it is:

- explicitly approved,
- merely implemented,
- or legacy/temporary.

Do not reverse-engineer product intent from the current UI.

## MVP discipline

Design the product Ceaute has now.

Do not make MVP interfaces more complicated in anticipation of future features.

Future direction may be documented without surfacing it in the current UI.

Examples:

- Payments may eventually contain earnings and payouts.
- The MVP Payments screen does not therefore need financial dashboards.
- Booking payment options may expand later.
- Do not expose future choices now.

## Language

Use customer/provider language rather than internal terminology.

Avoid technical Stripe, database or architecture terminology unless the user genuinely needs it.

Keep copy concise and human.

Do not manufacture personality in every sentence.

Ceaute is approachable, not chatty.

## Final check

Before presenting or implementing a Ceaute design, ask:

- Did I invent a product relationship?
- Did I expose implementation complexity to the user?
- Did I add a screen or step without a user decision occurring there?
- Did I force consistency where the sections actually have different needs?
- Did I show too much information before it is useful?
- Did I introduce a future feature into the MVP?
- Did I treat the current implementation as product authority?
- Did I turn an UNDECIDED question into an assumption?

If yes, revise before proceeding.
