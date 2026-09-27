# How agents work on Ceaute — plan, 28 September 2026

Status: **step 1 built on branch `agent-local-journey`; steps 2–6 not started.**

The aim is for each week to show three things: something a provider can now
do, the evidence that it works, and one piece of recurring work the owner no
longer has to supervise. Speed alone is not the aim.

## Where Ceaute started

Already in place on 28 September 2026:

- Decisions live in the repository (`docs/product.md`, `docs/decisions/`), not
  in chat.
- 26 pgTAP files, 89 unit test files and two race scripts
  (`scripts/db-races/`).
- An honest reporting rule: verified, unverified or waived
  ([verification](../verification.md#reporting-results)).
- The `ceaute-change` workflow, with a product lane, two plan critics and two
  diff reviewers.
- Real provider interviews
  ([2026-09-26](2026-09-26-provider-interviews.md)) and a usability test
  ([2026-09-27](2026-09-27-availability-usability-test.md)).

The gaps:

1. **Agents could not run a journey.** There were no local test accounts, no
   seed data, and agents were not allowed to sign in at all, so the owner
   carried errors, records and screenshots between tools.
2. **Investigating a booking took many lookups:** the booking, payment
   attempts, Stripe events, refunds and emails, each checked separately.
3. **Rules were not linked to their checks.** Nothing showed which test proves
   "provider cancels → full refund", or which rules have no test.
4. **Review leaned towards "looks good".** In `ceaute-change`, each review
   finding goes to an agent that tries to disprove it, and that agent is told
   to drop the finding when unsure. Nobody ever plants a known bug to see
   whether the checks catch it.
5. **Nothing was measured.** There was no record of the owner's time per task,
   so no way to tell whether a new way of working helps.

## Decisions (owner, 28 September 2026)

- Agents may sign in **on the local stack only**, and only to seeded
  `@ceaute.test` accounts. Preview and production are unchanged: only the
  owner signs in there. Recorded in [verification](../verification.md#reporting-results).
- Local runs use **their own Stripe test sandbox**, never the one Preview uses,
  so local payment events never reach Preview's webhook.

## Steps

| # | Step | Required result | Status |
| --- | --- | --- | --- |
| 1 | Make one journey runnable by an agent: provider publishes → customer books and pays → provider cancels → customer is refunded | An agent runs it on the local stack and shows `local:timeline --stripe` with every check agreeing | Built. Sign-in, seed and timeline verified locally. Payment steps wait for the owner's sandbox setup |
| 2 | Link each important rule to its check ([rules and evidence](../rules-and-evidence.md)) | Every rule shows its test or says "no check" | Built with step 1 |
| 3 | Test event orders, not single steps: hold expires, then a late payment arrives, then the event is retried, then the booking is cancelled | A script that runs these orders on the local stack and fails on any broken rule | Not started |
| 4 | Make review independent: a reviewer that gets only the requirement and the code must give a reproducible counterexample, and a planted defect (for example, removing duplicate-event protection on a scratch branch) must be caught | One planted defect per money path, and each is caught | Not started |
| 5 | Measure: for the next ten tasks, note the owner's active minutes, elapsed time to an accepted result, defects found later, and model cost | Ten rows, then compare | Not started |
| 6 | Watch a real provider try one journey. An agent analyses the notes: each observation tied to evidence, competing explanations, and the cheapest test that tells them apart | One observed session and one decision it changed | Not started (owner-led) |

Tooling is capped: steps 1–4 get about a week in total. Providers do not wait
for tooling.

## How to hand an agent a task

A task is complete when the failure was reproduced, the fix was made, the
result was checked against the agreed rules, and the result was shown
working. "Code changed" is only a step towards that. A good task names:

- the outcome, in the provider's or customer's words;
- the constraints (the invariants in
  [engineering principles](../engineering-principles.md#invariants-we-do-not-trade-for-speed));
- the environment (the local stack, with the commands in
  [verification](../verification.md#local-agent-runs));
- the completion evidence: for a booking or payment, the timeline with its
  checks agreeing;
- the questions that come back to the owner: policy, money and one-way doors.

Parallel agents are for separable work, such as competing causes or
independent reviews, not for several agents editing booking logic at once.

## Keeping the owner's judgement ahead of the code

For a booking, payment or refund change, write down a prediction before the
agent starts: what will fail, and what the database should hold afterwards.
When it is done, explain how it works without help, then have an agent check
that explanation against the code. The questions to be able to answer:

- Where is double booking prevented, and what happens if that check is
  removed?
- What happens when a payment arrives after the hold has expired?
- How does a failed refund get retried, and who finds out?
