# Copy

How Ceaute's words are written: in the interface, emails, errors and empty
states. The voice itself is in the skill's Language section and the tone split
between providers and customers is in `visual-language.md`. This file is the
method, the list of things to avoid, and examples taken from the app.

## Method

Read the whole path the person is on, not one string at a time. For each state
or message, decide:

1. the one fact the person needs now;
2. the action they can take next, if there is one;
3. any context that changes that decision (usually money or time);
4. the tone the moment needs. A cancellation or a failed payment is not the
   moment for personality.

Say each idea once. If the heading already says it, the text below adds
something new or is removed.

- Buttons and links name what happens, with a verb and an object when it isn't
  obvious: "Add treatment", "Cancel booking", not "Submit" or "OK".
- One word per concept everywhere: the terms in `docs/domain.md`, in the words
  providers and customers use. A booking is not also an "appointment request"
  on another screen.
- Destructive actions name the thing and the consequence. Prefer undo or
  archive over a confirmation when recovery is possible.
- Errors say what happened and how to recover, without apology, blame or raw
  system text.
- Whenever money might have moved, say whether it did.
- Sentence case for headings, buttons, labels and email subjects.

Ask the owner before changing a factual claim, anything legal, or a term that
may carry a domain meaning.

## Avoid

**Internal language.** Database, Stripe and architecture names that the person
does not need: `provider_page`, snapshot, hold, connected account, application
fee, webhook, Checkout Session. Operator emails may name Stripe, because
Stripe is where the operator acts.

**Manufactured personality.** Greetings, emojis, exclamation marks, motivational
lines, cute empty states, chatty helper text. Personality has to be earned (see
`visual-language.md`).

**AI writing tells.** These make copy read as generated:

- "Not X, but Y" or "It's not just X, it's Y" contrasts that add emphasis
  rather than information.
- Staged openers ("Here's the thing", "Let's…") and one-line closers that
  repeat the point.
- Lists of three where the content has two or four.
- Inflated words: seamless, effortless, elevate, unlock, empower, delve,
  pivotal, robust, journey (for anything but a user journey in docs).
- Hedging and filler: "simply", "just", "please note that", "in order to".
- Em dashes in customer and provider copy. Use a full stop or a comma.
- Bold used for decoration rather than to mark the one fact that matters.

**Vague errors.** "Oops", "Something went wrong" on its own, "An error
occurred". A general heading is fine only when the next line says what
happened and what to do.

## Examples from the app

**Email subjects** name the event plainly, from the reader's side:
"Your booking is confirmed", "New booking confirmed", "A customer cancelled a
booking", "Your provider cancelled a booking", "We're refunding your payment".
(`src/lib/emails/booking-email-content.js`)

**Email openings** are one sentence of what happened, then where the details
are: "Your booking has been cancelled. Your refund details are below." "A
customer has booked and paid. Here is everything you need for the
appointment."

**Money reassurance** comes first when a payment did not complete: "Nothing has
been charged. Try again later, or book with someone else." "Nothing has been
charged. The time may still be free: choose it again to book."

**Route error** keeps a general heading but gives the consequence and the
recovery, and never shows raw error text: "Something went wrong" / "Ceaute
could not finish that request. If you were paying for or cancelling a booking,
check your bookings before trying again." (`src/lib/errors/route-error.js`)

**Empty states** state the fact, and add the next action only when there is
one: "No upcoming bookings." "No blocked dates." "No active groups. Restore one
from Archived or add a new one." "No treatments match “{query}”."

---

The method is adapted from Impeccable's `clarify` reference (pbakaus/impeccable,
Apache-2.0). The AI-tell list draws on blader/humanizer (MIT), which is based on
Wikipedia's "Signs of AI writing".
