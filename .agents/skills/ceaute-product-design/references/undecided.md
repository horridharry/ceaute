# Ceaute — Undecided Product and Design Questions

This file prevents open questions from becoming accidental requirements.

Items here may be explored.

They must not be silently decided.

## Branding

UNDECIDED:

- final brand palette
- final typography
- detailed visual identity
- permanent border/card language
- motion language

Current direction is neutral-first with colour as accent.

## How the name is said

UNDECIDED, and left open to findings (27 September 2026). In the interview transcripts "Ceaute" came out as "Qt", "QE" and "Cute". The product owner collects how people hear and type the name over time; findings go into a dated report in `docs/reports/`. Buying lookalike domains or renaming waits for them.

That direction does not define exact brand values.

## Customer Portfolio preview count

Current MVP direction:

- customer sees at most 3 Portfolio preview images

Potential future direction:

- expand to 6

Decision should be informed by usage/data.

The stable principle is a small preview followed by the full masonry experience.

## Portfolio implementation details

UNDECIDED where not otherwise specified:

- exact masonry spacing
- exact image aspect-ratio handling
- transition into individual image view
- exact modal/sheet/fullscreen presentation

Provider and customer full viewing experiences should match.

## Booking confirmation delight

Ceaute should explore making successful booking confirmation enjoyable and rewarding.

UNDECIDED:

- animation
- motion
- celebratory treatment
- imagery
- confetti or alternative
- sound/haptics where applicable

Do not implement confetti simply because Robinhood was used as an example.

## Payment-choice evolution

MVP:

Provider chooses either:

- full payment
- deposit, flat or percentage (decision 008)

Possible future direction:

Provider may enable multiple options and allow the customer to choose how to pay.

Not MVP.

## Fixed deposit amounts

Decided 27 September 2026 by the product owner: `docs/decisions/008-flat-deposit.md`.

Whether to retire the percentage deposit, if no pilot provider picks it, is a later decision.

## Payments expansion

Current Payments purpose:

- connect Stripe
- understand connection/setup status

Future possibilities:

- revenue
- earnings
- payout information/management

These are not current MVP requirements.

## Customer-facing Policies

The section itself was decided on 27 September 2026 (`customer-experience.md`, Policies).

UNDECIDED:

- how long house rules are shortened on the provider page, for example a "Read more" that opens every rule on a separate page, without repeating them between the page, Review and pay and the held page

The owner wants something better than a plain "Read more". Until that is designed, it is one section.

## Location editing after autocomplete

Address autocomplete is intended.

UNDECIDED:

- exactly how structured address fields appear after selection
- whether/how every component can be manually corrected
- detailed error/recovery interaction

Do not invent behaviour without resolving this if implementation requires a visible product decision.

## Navigation

Known:

- mobile-first
- menu control on the right near profile access
- menu exposes independent provider areas

UNDECIDED:

- exact ordering
- exact grouping
- section labels where not already established
- desktop adaptation
- drawer width and detailed presentation

Do not infer grouping from technical relationships.

## Reviews presentation

Known:

- provider page previews up to 3
- all reviews available separately
- all-review list is most-recent-first

UNDECIDED:

- exact review-card presentation
- exact `See all reviews` vs `Show all reviews` wording
- filtering/sorting beyond current chronological behaviour

## Treatment management presentation

Known:

- Treatments organised by Treatment Group
- search by Treatment name
- Group filter pills
- selecting Treatment edits it

UNDECIDED:

- exact card styling
- exact balance of cards/dividers
- precise responsive layout

Use the visual-language principles rather than inventing a permanent pattern.

## Provider category

Known:

- Profile contains provider/business Category
- Category is required for publication
- it is distinct from Treatment Groups

Any broader category taxonomy/discovery behaviour not explicitly defined elsewhere remains UNDECIDED.

Do not invent additional Treatment category systems from legacy code or documentation.

## Drops: later

Left out of the first drops release on 27 September 2026 (`docs/decisions/007-availability-released-in-drops.md`).

The drop kit (idea #6), a share image and link for a drop, is approved as its own change straight after drops. What it says and how it looks are UNDECIDED.

Do not build without a new decision:

- messaging customers in the app: no
- an email to customers when a drop opens: only if it adds MVP value
- reminders to the provider, such as "nothing open after 31 October": only if they add MVP value
- an "always open" option that creates dates by itself
- several time ranges on one date

Raised in the 27 September 2026 usability test (`docs/reports/2026-09-27-availability-usability-test.md`), to research before any design:

- premium slots: early times kept for chosen customers, or times anyone can book for a higher price. One provider asked once.
- seeing the result after saving a drop: whether the provider means the storefront, the booking screen or a summary, and whether the link to their own page already covers it.

## Future functionality generally

A future idea is not an MVP requirement.

When encountering an idea discussed as:

- eventually
- later
- potentially
- depending on data
- if providers request it

keep it outside current implementation unless explicitly promoted into scope.
