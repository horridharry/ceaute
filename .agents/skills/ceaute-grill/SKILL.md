---
name: ceaute-grill
description: Interview the owner about a Ceaute plan, feature or change until every decision is settled, writing settled terms and decisions into Ceaute's own docs as they are made. Invoke with /ceaute-grill when a plan is still fuzzy, before any design or code.
disable-model-invocation: true
---

# Ceaute grill

Run the `grilling` skill for the interview, with the Ceaute rules below
layered on top. `grilling` supplies the rounds, the numbered questions with a
➡️ recommended answer, and the rule that facts are looked up rather than asked.
This skill says what to read first, which facts count as authority, and where
settled answers are written.

## Before the first round

Read only what the topic touches:

- `docs/product.md`: the sections for the journeys in scope.
- `docs/decisions/README.md`, then any record it links that the topic touches.
- `docs/domain.md`: the terms the topic uses.
- For visible product work, the `ceaute-product-design` skill, including
  `references/undecided.md`.
- The recalled memory for approved decisions not yet copied into a doc.

A decision found in any of these is settled. Do not ask it again. If the plan
contradicts one, ask only whether to revisit it, and say which document holds
it.

## During the interview

- **Facts come from the repo, not the owner.** Behaviour comes from the code,
  and the ordered files in `supabase/migrations/` are the final authority for
  anything the database enforces (later migrations can replace earlier
  functions). Send a subagent to look it up.
- **The implementation is evidence, not product authority.** When the code and
  the owner disagree, point out the mismatch and ask which one is intended. Do
  not settle it in favour of the code.
- **Hold terms to `docs/domain.md`.** When the owner uses a word that conflicts
  with a defined term, or an overloaded one such as "account", "page" or
  "cancel", name the conflict and propose the defined term.
- **Test boundaries with concrete scenarios**: a customer who cancels a
  deposit booking 13 hours before the appointment when the window is 24 hours; a provider who unpublishes with
  bookings pending; a late payment for an expired hold.
- **Record gaps, don't fill them.** A question the owner chooses not to answer
  is written down as `UNDECIDED`, not given a default.
- **Keep the MVP small.** If a branch of the tree is a future feature, ask
  whether it is in scope before exploring it.

## Writing settled answers

Write each answer to its document when the owner settles it, not at the end.
Follow the format each document already uses.

| What was settled | Where it goes |
| --- | --- |
| How the product behaves | The matching section of `docs/product.md` |
| What a term means | `docs/domain.md`, as prose in the matching section, not a glossary list |
| A visual or interaction rule | `docs/design-system.md`, or the matching `ceaute-product-design` reference |
| A one-way-door choice | A new `docs/decisions/NNN-slug.md` plus a row in its README table |

A decision needs a record when it is hard to reverse, constrains stored data or
external systems, or will look wrong without its context. Any one of these is
enough (`docs/engineering-principles.md`). Number it after the highest existing
record, and use that folder's format: context, decision, consequences, and what
reversing it would cost. Most answers do not need a record.

Do not restate in one document what another already owns.

## Stop

The interview ends when the frontier is empty and the owner confirms you share
an understanding. Then report:

- each document changed, with one line on what changed;
- every question left `UNDECIDED`;
- the next step (a design, a specification, or an implementation task).

Do not write code or start the next step until the owner asks.

---

The `grilling` skill and the terminology and scenario habits above are adapted
from Matt Pocock's `grilling` and `domain-modeling` skills
(github.com/mattpocock/skills, MIT).
