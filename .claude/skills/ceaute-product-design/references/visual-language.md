# Ceaute Visual Language

This document defines current visual direction.

It is not a finished brand system.

Do not turn temporary MVP choices into permanent brand rules.

## Overall character

Ceaute is:

- clean
- operational
- approachable
- visually considered
- mobile-first

It should not feel like:

- enterprise SaaS
- a generic analytics dashboard
- a sterile database interface
- an excessively playful consumer app
- an interface trying too hard to be friendly

The current direction is primarily restrained and operational, with selective warmth.

Personality should support the experience rather than compete with the provider's work.

## Neutral first

Ceaute is predominantly neutral.

Colour should primarily act as an accent.

Potential uses include:

- primary actions
- selected states
- active controls
- important interaction emphasis
- brand moments

Do not wash large portions of the interface in brand colour without a reason.

Providers have their own identities and visual work.

Ceaute should provide a strong frame without forcing an overpowering visual identity onto them.

Exact brand palette is UNDECIDED.

## Neutral does not mean soulless

Warmth can come from:

- typography
- spacing
- photography
- imagery
- rounded forms where appropriate
- comfortable touch targets
- thoughtful motion
- concise human language
- moments of delight

Do not compensate for weak hierarchy by adding colour.

## Bounded, not container-happy

Ceaute generally likes bounded designs and cards.

However:

> A discrete object does not automatically require an enclosing card.

Use containers when they provide meaningful:

- grouping
- interaction
- hierarchy
- separation
- emphasis

Do not add borders/cards merely to prove that items are separate.

### Discovery example

Provider discovery should not automatically put every provider inside an outlined white card.

Provider imagery, typography and whitespace can already establish the visual unit.

Avoid redundant:

image container
inside provider card
inside page container

when those layers communicate nothing.

### Treatment example

Treatments can reasonably use cards because each Treatment is a distinct tappable management object containing several related pieces of information.

Cards should make sense for the content, not be a universal component rule.

## Spacious without wasting space

Ceaute should breathe.

But spaciousness does not mean every control must occupy the full width.

Let control size/layout reflect the information being entered.

Example:

Name and Description naturally benefit from width.

Duration and Price are short, related Treatment attributes and may reasonably share a row on mobile if the result remains clear.

Do not aggressively compress screens simply because multiple controls technically fit beside each other.

Rule:

> Compact related information when it improves comprehension. Do not maximise density.

## Progressive disclosure

Avoid turning management pages into walls of controls.

Default to a useful summary.

Reveal editing controls when the user intends to edit.

Availability is a reference interaction:

Collapsed:

Monday 9 am to 5 pm
──────────────────────────────────────────

Expanded:

Monday 9 am to 5 pm

☑ Open on Monday

Opens Closes
9 am 5 pm
──────────────────────────────────────────

This principle can be reused where appropriate.

Do not apply accordions everywhere merely because Availability uses one.

## Cards and borders

Cards are welcome when they create meaningful structure.

Borders are not forbidden.

Neither should become automatic.

For the Availability MVP, simple divider lines beneath weekday rows are acceptable.

This is not a universal Ceaute border rule.

## Imagery

Provider imagery is a major part of Ceaute's visual identity.

Where provider work is already visually rich, allow it to carry the interface.

Avoid unnecessary decoration competing with Portfolio or hero imagery.

Portfolio viewing should progressively move from:

small preview
→ masonry
→ focused individual image

## Provider vs customer tone

Provider management should generally lean toward calm, efficient, operational presentation.

Customer-facing experiences have more room for:

- imagery
- expression
- emotional engagement
- moments of delight

This does not mean maintaining two unrelated design systems.

They should clearly belong to the same product.

## Personality

Avoid excessive conversational UI.

Do not automatically add:

- greetings
- emojis
- motivational copy
- cute empty-state messages
- chatty helper text

A line such as `Hey Harrison 👋 Here's your day` may work in some contexts but should not become the default Ceaute voice.

Personality must feel earned.

## Confirmation and delight

Important successful moments may be more expressive than routine management.

Booking confirmation is the clearest current example.

Explore delight deliberately when designing that experience.

Do not choose a specific effect until approved.

## MVP versus branding

Ceaute does not yet have a final visual brand system.

Therefore:

- do not invent a permanent palette
- do not over-specify brand motifs
- do not build a complicated token system around temporary visual choices
- do not claim MVP visual choices define the final brand

The MVP should still feel coherent and intentional.
