# Provider interviews: the pattern, ranked features and what they mean for Ceaute

Date: 26 September 2026. Source: four recorded interviews with independent
beauty providers. Each was asked about their current booking routine and then
shown Ceaute; three also used it by remote control. Claims about Ceaute are
checked against `docs/product.md`, the decision records and the migrations on
`preview` that day.

The repository is public, so participants are Providers A–D, and names and
personal details are left out. Recordings and transcripts are not stored here.

## Summary

- **One pattern runs through all four interviews.** Each provider runs a
  "drop" business. They plan next month privately, announce it on Instagram,
  release every slot at once on a set date, secure each booking with a small
  flat deposit, check the client before the day, and enforce house rules
  because they often work from home.
- **Ceaute fits the end of that routine and misses the start.** Private
  addresses, locations, confirmation emails, verified reviews and inspiration
  photos all fit. Availability, deposits, policies and pre-booking checks do
  not, because Ceaute assumes a salon's rolling weekly diary.
- **Rebuild one feature and change two.** Rebuild availability around
  scheduled drops. Add a flat deposit, which revisits
  [decision 006](../decisions/006-percentage-booking-terms.md). Give policies
  headed sections.
- **The interviews raise business questions as well as feature requests.**
  - Sell the provider's booking link before the marketplace.
  - Settle one price story. The founder mentioned subscriptions, the provider
    agreement says there are none, and 2% of a £10 deposit does not cover
    Stripe's per-account charge.
  - Check the name, which is said "cute" but spelt Ceaute.
- **Governance changes.**
  - Write down the rule the founder already uses for requests: platform rules
    stay standard, and providers' own wording can be customised.
  - Make any decision that changes the product model cite provider evidence.
  - Run the trials as a pilot with a stated exit.
  - Put review moderation in place before reviews become the pitch.
- **Timing.** C could start now. B's next drop is 15 October at 7 pm and A's
  is 17 October. D starts when their Acuity month ends.

## Who we spoke to

| | Work | Takes bookings through | Releases slots | Deposit |
|---|---|---|---|---|
| A | Nails | Acuity | Monthly, on the 17th | Flat, one amount for the whole business (preferred) |
| B | Hair: installs, sew-ins | Acuity, on the phone | Monthly, at 7 pm on the 15th, after an Instagram countdown | Flat £15 |
| C | Hair styling | Instagram DMs, no booking tool | At the start of each month, free dates only | Not stated |
| D | Lashes, home-based | Acuity | Every two weeks now; monthly while at university | Flat, about £10 |

B, C and D were asked about their routine first and then given tasks. A's
recording starts about ten minutes in, after A had already described the
calendar they wanted. A's session is a demo with questions.

## How much weight this can bear

- **The sample is close to the founder.** All four come from the founder's
  network, and A is a close relative. "I'd try it" is weak evidence. A
  provider switching the link in their bio and taking real bookings is strong
  evidence. A was the most critical of the four, which makes A's objections
  more credible, not less.
- **Most praise was prompted.** It usually came straight after the founder
  showed a feature and asked "which feature do you really like?". This report
  gives more weight to what providers do now, what they did in the tasks and
  what they raised unprompted. The counts below mean "raised by", not "asked
  of all four".
- **The transcripts are automatic and garble words.** "Qt", "QE" and "Cute"
  all mean Ceaute.
- **Never asked:**
  - what they pay today or would pay;
  - how they find new clients;
  - whether they refund a deposit when a client cancels early;
  - how many bookings they take a month.

  No customers were interviewed. C and D only played customers in the demo.

## The pattern: a drop business run from Instagram

| Step | What they do | Raised by |
|---|---|---|
| 1. Plan privately | Work out next month's free dates and times, often with different hours on different dates | A, B, C |
| 2. Announce | Post to Instagram. B runs a countdown, then posts a picture of the slots | B |
| 3. Release at a set moment | Everything goes on sale at once, and demand spikes | All four. C sees clashes "when there's events going on" |
| 4. Secure the slot | A small flat deposit; the balance is paid in person | A, B, D |
| 5. Check the client | Inspo pictures, hair length, a consent form, "have you read the terms?" | A, C, D |
| 6. The appointment | Often at home, under house rules: no plus-ones, punctuality, a late fee | A, D |
| 7. Collect proof | Reviews go to Instagram stories and highlights | D |

How the four compare (– means not raised, not the opposite):

| | A | B | C | D |
|---|---|---|---|---|
| Releases slots in batches on a set cadence | ✓ | ✓ | ✓ | ✓ |
| Plans by month or date rather than a repeating week | ✓ | ✓ | ✓ | – |
| Clients arrive through social media or messages | ✓ | ✓ | ✓ | ✓ |
| Takes a flat deposit | ✓ | ✓ | – | ✓ |
| Has house rules they care about | ✓ | – | – | ✓ |
| Needs information from the client before the day | ✓ | – | ✓ | ✓ |
| Liked inspiration photos | ✓ | ✓ | ✓ | ✓ |
| Said setting up or switching a tool is hard work | ✓ | ✓ | ✓ | ✓ |

Where Ceaute fits the routine today:

| Step | Ceaute today | Fit |
|---|---|---|
| 1. Plan privately | One working period per weekday, plus blocked dates. Saving hours puts the next 60 days on sale at once. | No |
| 2. Announce | The `/@username` link and its preview image | Partly |
| 3. Release at a set moment | Not possible. A rush is safe, because an exclusion constraint stops overlapping bookings. But a new customer signs up by email code before any hold exists. | No |
| 4. Secure the slot | Percentage deposits only, since decision 006 | No |
| 5. Check the client | Inspiration photos, but only after payment. No questions. | Partly |
| 6. The appointment | The address stays private until payment. Locations cover term-time and home. Both sides get a confirmation email. PostgreSQL enforces 24 hours' notice. House rules are one plain-text policy. | Mostly |
| 7. Collect proof | Reviews from verified bookings, shown on the page | Yes |

Ceaute already handles the end of the routine, from the appointment to the
review. It does not fit the start, from planning to paying, and that is the
part a provider sees first.

## Themes

### 1. Slots are released in drops, not opened as weekly hours (4/4)

All four release in batches:

- **A** builds next month before the 17th, wants it hidden until then, and
  confirmed that two Wednesdays in the same month can have different hours.
- **B** sets availability a month at a time. B sometimes offers only fixed
  start times (9 am, 12 pm) so that a 230-minute install cannot start at 9:30.
  B opens the slots by hand on the phone a few minutes before 7 pm: "You have
  to basically do it manually."
- **C** releases the dates they are free at the start of each month.
- **D** moved from monthly to fortnightly releases after leaving university,
  so the cadence has to allow any date, not only a monthly rule.

When B opened Ceaute's Availability screen, B's first words were "So this is
weekly hours."

**Gap.** If B saved working hours in Ceaute on 26 September, customers could
book 1–25 November straight away, three weeks before B's drop.

### 2. A deposit is a flat fee to secure the slot, not a share of the price (3/3 who stated one)

- **B** takes £15 ("Only fixed price").
- **D** takes about £10.
- **A** wants one amount across the whole business, because a percentage
  makes people do sums: "to make things easier for people is how you sell to
  people."

Playing customers, C ("That's good") and D ("20% is fine") both accepted a 20%
deposit. So the percentage does not cause trouble at checkout. The problem is
on the provider's side: how they think about the deposit, and the line they
post on Instagram.

**Gap.** Decision 006 (23 September) made booking terms percentage-only,
reasoning that "a fixed amount means nothing across treatments of different
prices". For these providers that is the point. The deposit is a commitment
fee, the same whatever the treatment costs.

### 3. House rules are long, specific and personal (A, D)

**A** said one written-policy box "doesn't suit me":

- A's rules need headings, so clients know "what they're reading, and why
  they're reading".
- Hair providers, A said, "have a lot more to say".
- A charges £15 after 15 minutes late. Ceaute's terms do not cover that.

**D** called policies "very important": no plus-ones, first in a studio flat
and now at home, plus punctuality and respect for the space.

In A's interview the founder said "you all seem to have the same policies".
That is half right. The parts Ceaute can enforce (the deposit, the
cancellation window and what is kept) are the same for everyone, and Ceaute
already writes them out from Booking settings. What differs is the house
rules.

**Gap.** Ceaute has one optional written policy, shown as plain text at Review
and pay and on the held page. The storefront has no terms section. A late fee
can be written down, but Ceaute has no way to charge it after booking.

### 4. Providers check the client before committing (A, C, D)

- **D** uses a consent form, because lash extensions can leave eyes red.
- **C** asks the client's hair length in inches before accepting some
  styles, by messaging back and forth.
- **A** asked for intake forms, such as confirming the client has read the
  terms.

The timing matters. Today these checks happen before the booking is agreed.
In Ceaute, inspiration photos can only be added after payment, so the only
way out of an unsuitable booking is a provider cancellation, which refunds
everything. Questions therefore have to come before payment, at Review and
pay.

Two limits apply:

- "Have you read the terms?" is already covered better than a tick box. Every
  booking keeps a copy of the terms and written policy the customer saw.
  Providers need to be told this.
- Health questions, such as allergies, would be special category data under
  UK GDPR. Start with acknowledgements and non-health questions.

### 5. What already lands

- **Inspiration photos (4/4).** A said "you have to always ask clients, like,
  what's your inspo?". It was C's favourite feature, because clients
  sometimes send C a photo of C's own work.
- **Reviews (B, D).** For D it was "the biggest one", because D's reviews
  currently sit in Instagram stories: "That'd make my life so much easier."
  Reviews come only from verified bookings, which is the right side of the
  DMCCA 2024 rules on fake reviews. There is no moderation process yet (see
  the governance section).
- **Portfolio captions (A, C).** A wants each caption to name the treatment
  to book, because clients message asking what to book under. C liked that
  clients can browse past work.
- **Locations (B).** B called it "really good". D's own history (a studio at
  university, then home) is the case it was built for.
- **Ease (D).** "You didn't even give me a tutorial, and I just kind of
  guessed."
- **Reliability.** D's Acuity once let a client book with under 12 hours'
  notice despite a 24-hour rule, and C gets clashes around events. In Ceaute,
  PostgreSQL enforces both the notice period and no overlapping bookings.
  That belongs in the pitch; it does not need building.

### 6. Setup and switching decide adoption more than features do (4/4)

- **C** has no booking tool because setting one up is "very long and
  confusing". C has the most to gain and nothing to leave.
- **B** finds writing treatments and working out durations the slowest part,
  and relies on Acuity to tell them what to put.
- **A** has used Acuity for a long time. A would have to learn a new tool,
  teach clients a new link, and said "Right now, I wouldn't."
- **D** learned Acuity from another lash tech and TikTok walkthroughs. D
  values that "nothing has changed" in two years, and had already paid for
  this month.

So:

- Move each provider at a natural moment, such as their next drop or their
  renewal.
- Set the page up with them.
- Make a short walkthrough video, because that is how D learned.

### 7. What Acuity still does better (A)

A named:

- **The Home screen summary.** Revenue this week, appointments, hours
  booked, the change on last week, and revenue with and without deposits.
- **Colour-coded treatment groups** on the calendar.
- **Rescheduling.** In Ceaute a customer has to cancel and rebook, and pays a
  new deposit. A's reaction was that providers want to decide that
  themselves.
- **Faster payouts.** A likes Square because the money arrives sooner, but
  called it optional.

B relies on both sides getting a confirmation email, which Ceaute already
sends.

### 8. Friction seen in the sessions, and "don't make me do sums"

- To edit the profile, C tapped the profile photo and then "your business":
  "I clicked your business, it's not doing anything."
- C moved the last portfolio photo to first with repeated "move earlier"
  taps. The portfolio pop-up also stops short of the bottom of the screen.
- C looked for the deposit setting under Payments. It lives in Booking
  settings.
- D said "180 minutes, I think? Two and a half hours?" The duration field is
  in minutes (`Duration (minutes)`), but providers think in hours.
- D took a couple of attempts to find View your page.

A's point about ease applies to more than deposits. Percentages and durations
in minutes both make providers do sums.

## Ranked feature ideas

Each idea is ranked first by whether it stops a named provider from trialling,
then by how many providers raised it or were seen needing it, then by cost.
**Money/DB** marks an idea that changes payments or a rule PostgreSQL
enforces. Those go through the `ceaute-change` workflow, with owner gates.

| # | Feature | Evidence | Blocks a trial? | Size |
|---|---|---|---|---|
| 1 | **Drop availability.** Set hours per date for a coming period, keep them hidden, then release them at a chosen date and time. Weekly hours become a quick way to fill the dates. | 4/4 | Yes: A, and B's 15 October drop | Large, money/DB |
| 2 | **Flat deposit.** One £ amount for the whole business, kept after a late cancellation. The percentage stays as the other option. | 3/3 who stated a deposit | No, but A asked, and it is the line providers post | Medium, money/DB |
| 3 | **Structured house rules.** Headed sections (guests, lateness, preparation, aftercare, other) under the terms Ceaute already writes from Booking settings, readable before booking. Text only. | A (blocker), D | Yes: A | Small |
| 4 | **Booking questions before payment.** Questions the provider writes per treatment, with required answers. One kind is an acknowledgement of treatment risks. Answers stay private to the booking. | A, C, D | No | Medium |
| 5 | **Setup help.** Starter treatments per category, with typical durations and prompts for "what's included" and "what to bring". Do this by hand with each pilot provider first. | B, C, D | Not for these four; at scale, yes for providers like C | By hand now, then medium |
| 6 | **Drop kit.** A shareable "slots open on…" link and image, then a "slots are live" one, with a prompt for clients to create their account before the drop. | B's routine; follows from #1 | No | Small–medium |
| 7 | **Book this look.** Link a portfolio photo to its treatment, so a customer can book from the photo and the booking records which photo they chose. | A, C | No | Small–medium |
| 8 | **Quick fixes.** The profile photo opens Profile; a portfolio photo moves to first in one step; fix the pop-up height; link the deposit setting from Payments; enter durations in hours and minutes. | Seen in C's and D's sessions | No | Small each |
| 9 | **Weekly insights on Home.** Revenue, appointments, hours booked, change on last week. | A | Part of A's gap | Small–medium |
| 10 | **Appointment reminders.** | Inferred from C's complaint about client reply times; already on product.md's list of what isn't implemented | No | Medium |
| 11 | **Reschedule without a new deposit.** | A | No | Large, money/DB |
| 12 | **Colour-coded treatment groups** in Bookings. | A | No | Small |
| 13 | **Faster payouts.** Check Stripe's payout options before any work on Square. | A, who called it optional | No | Park |

**Don't build more marketplace yet.** No provider asked for help finding
clients. Discover gains nothing from the drop pattern until an area has enough
providers to browse.

## What the interviews mean beyond features

### Product: rebuild availability around the drop

**Why rebuild rather than patch.** The availability rules live in PostgreSQL:
one working period per weekday, whole blocked dates, 24 hours' notice, a fixed
60-day window and a 15-minute grid. They are checked when hours are saved and
when a hold is made. Under those rules, saving hours puts every date in the
window on sale. The only workaround shows how poor the fit is. To run B's
15 October drop today, B would:

1. close every day;
2. block the rest of October (still on Acuity) one date at a time;
3. block 1–14 December the same way;
4. save the weekly hours at 7 pm.

Even then, B could not set different hours on different dates.

**The simplest shape to discuss** (with `ceaute-grill`, then `ceaute-change`):

- **Hours per date.** Each available date gets a start and an end.
- **A release time.** It applies to a batch of dates, so a drop is just a set
  of dates with a release time. The founder's idea in A's interview, "multiple
  calendars" each visible from a date, is the same thing with one more object.
- **Weekly hours as a template.** They stay as a quick way to fill a month.
- **No 60-day window for drops.** For a provider who uses drops, the released
  dates replace the window.
- **Fixed start times (B) later.** They can wait for a second pass.

This changes what PostgreSQL will accept as a hold
([ADR 001](../decisions/001-postgresql-protects-booking-integrity.md)), so it
is a one-way door and needs a decision record.

**Rehearse a drop on Preview before B's real one.** A drop sends many
customers to the page at once, which brings two risks:

- A hold lasts ten minutes, extended to about 31 while Checkout is open. Slots
  that customers abandon look taken, then reappear.
- A new customer signs up with an email code before any hold exists, so they
  can lose the slot while fetching the code.

The drop kit (#6) should tell clients to create their account before the
drop.

### Product: add a flat deposit (revisit decision 006)

For new bookings this is additive. Decision 006 stores pence amounts in each
booking's snapshot (`amount_due_now_pence` and `commitment_amount_pence`), so
cancellation and refunds read the same fields whatever the terms were. 006
itself notes that changing terms for new bookings is cheap and reinterpreting
stored bookings is not. A flat option only affects new bookings.

Recommended shape:

- **Deposit.** Either a flat amount (at least £1.00 and never more than the
  price) or a percentage. Flat is the default.
- **Late cancellation on a deposit booking.** The provider keeps the deposit.
- **Full payment.** It keeps its percentage kept after a late cancellation,
  which A accepted without objection.
- **Later.** If no pilot provider picks the percentage, retire it.

### Business: sell the booking link first, the marketplace later

The README calls Ceaute "a marketplace", and `/` redirects to Discover. None
of the four raised finding new clients as a problem. Nobody was asked, so
treat that as untested. All four already have clients who reach them through
Instagram and messages. The founder said as much to C: Discover "will come
into effect later… It would just be a link on your page."

- **Pitch the provider's own page and link.** Leave Discover as it is until an
  area has enough providers to browse. With a handful of providers it looks
  empty to anyone who types the address.
- **Write a one-page provider brief before more outreach.** There is nothing
  to send a provider who asks what Ceaute is, and B asked for exactly that
  ("a brief"). It should cover what Ceaute does, how it differs from Acuity,
  what it costs and how to leave.
- **Start with providers who book through DMs, like C.** They have no tool to
  leave and the most to gain. Acuity users come over at their next drop or
  renewal.
- **Grow by referral.** D found Acuity through another lash tech and TikTok.
  Treat each pilot provider as a referral source, and make a short walkthrough
  video.

### Business: one price story, and one that covers its costs

In A's interview the founder said other providers "will be paying
subscriptions". The [provider agreement draft](../provider-agreement-draft.md)
says "There is no subscription, listing fee or monthly cost", and
[decision 004](../decisions/004-providers-bear-stripe-processing-fees.md) says
there are none during the alpha. Providers must hear one story, and it must
match what they accept.

The interviews also show that the current price earns very little:

- **Ceaute takes 2% of the money it processes.** These providers process only
  a £10–£15 deposit and take the rest in person. At £10 that is 20p a booking.
- **Stripe charges the platform £2 a month for each active connected
  account.** That charge alone needs 10 bookings per provider per month to
  cover. Payout fees (0.25% + 10p each) and the card-mix variance described in
  decision 004 come on top.
- **The fee depends on the deposit, not the price of the treatment.** A £150
  install with a £15 deposit earns Ceaute 30p.
- **Providers already pay Acuity every month.** D had already paid for this
  one. A subscription priced below Acuity is therefore plausible, but nobody
  was asked.

Keep the alpha on what the agreement says, and stop mentioning subscriptions
until they have been tested. Make "a price the provider would pay" one of the
pilot's success measures. A is not being charged, so A is not price evidence.

### Business: the name is said "cute" but spelt "Ceaute"

The founder says the name in all four recordings, and the transcription never
produced "Ceaute". It wrote "Qt", "QE" or "Cute", and the booking link became
"your Cute link". Recommendations are spoken: D heard about Acuity from
another lash tech. If a provider tells a client "book me on Cute", the client
has to find their way to `ceaute.com`.

This is cheap to test now and expensive to change after launch. Say the name
to five people and see what they type. Then either settle how it is said, or
secure the spellings people try.

### Governance: write down how a request becomes product

In A's interview the founder stated a sound rule. With too much leeway
"everybody starts making it their own thing", so a feature opens up "if
someone else requests it". Minutes later, when A said the policy box "doesn't
suit me", the rule gave way. An unwritten rule bends for whichever provider
is in the room.

Proposed text for [engineering-principles.md](../engineering-principles.md),
the document that covers how Ceaute decides what to build:

1. **Platform rules versus the provider's own words.**
   - A platform rule is anything that moves money, time or access: the
     deposit, the cancellation window, what is kept, the notice period, what
     is bookable. It gets few options, and PostgreSQL enforces it.
   - Anything that is communication belongs to the provider, inside a fixed
     structure: house rules, descriptions, questions.

   Structured house rules (#3) are the worked example. The founder keeps
   consistency and A gets headings.
2. **An evidence threshold.** Build something when two independent providers
   raise it unprompted, or when it blocks a named provider's trial and is
   small. Otherwise log it, with a tally, in the next dated interview report.
3. **Evidence in decision records.** A decision that changes the product model
   names the provider evidence behind it. Decision 006 cites none, and the
   first provider evidence, three days later, points the other way.

### Governance: research and personal data

- **Use one script for every interview.**
  - Ask about the current routine: releases, deposits, rules, pre-booking
    checks and reviews.
  - Ask what they pay now and what they would pay.
  - Ask how they find new clients.
  - Then run the tasks, then ask for reactions.
  - Ask about behaviour before showing anything. Replace "which feature do you
    really like?" with "what would stop you switching your link this month?"
- **Widen the next round.** At least half the providers should come from
  outside the founder's network. Add two or three of the pilot providers'
  clients.
- **Remember the repository is public.**
  - Keep recordings and transcripts out of it.
  - Store them privately, with a deletion date.
  - Ask for consent to record at the start of every session, as B's session
    did.
  - Keep reports anonymised, as this one is.

### Governance: run the trials as a pilot, with an exit

The offer to A was to switch the link for a month, keep Acuity, and turn
Ceaute off if it didn't work. A's first question was "Is that safe?" Trust
depends on the exit being real and explained up front. Before the first real
provider, write one page that covers:

- **The hypothesis and how it is measured.**
  - The share of the drop booked through Ceaute.
  - No clashes.
  - No provider cancellations for an unsuitable client.
  - The provider keeps the link after the month.
  - A price they would pay.
- **What leaving means.** Unpublishing stops new bookings. Confirmed bookings
  stay and keep working. The provider honours them, or cancels them with a
  full refund.
- **Support.** One channel to the founder, and how quickly they will answer.
- **Release readiness.** Starting any real provider triggers the production
  promotion in [release.md](../release.md). It also needs the before-alpha
  list closed:
  - a real contact inbox and address;
  - the full agreement shown before acceptance;
  - one test-card payment and refund on Preview;
  - the owner's keyboard pass.

  That sets the earliest start date as much as feature work does.
- **Review moderation before reviews are the pitch.** A function can hide a
  review, but no screen calls it and there is no runbook
  ([legal note](2026-09-18-legal-pages-review-note.md), item 5). Don't import
  past Instagram reviews as Ceaute reviews. They cannot be verified, and
  misleading reviews are what DMCCA 2024 targets.

### Organisation: capacity, sequence and rhythm

- **Capacity.** The top three changes are all money/DB work with owner gates,
  and one person builds them. As the founder said in A's interview, "coding
  takes a long time". Sequence the work by drop dates. Park the rest until the
  pilots report: Square, rescheduling, insights, colour codes and Discover.
- **A weekly rhythm while pilots run.**
  - One check-in with each provider.
  - One session for owner decisions, using `ceaute-grill` for anything fuzzy
    and recording the results in `docs/decisions/`.
  - Findings go into a dated report, as engineering principle 1 asks.
- **Material before outreach.**
  - The brief B asked for.
  - A "how to book with me" post that providers can share with clients,
    because A worried about teaching clients a new link.
  - The walkthrough video.

## Decisions for the owner

| # | Decision | Recommended default |
|---|---|---|
| 1 | Rebuild availability around drops | Yes: hours per date plus a release time, with weekly hours as a template. New decision record. |
| 2 | Deposits | Add a flat amount beside the percentage, defaulting to flat. New decision record revisiting 006. |
| 3 | House rules | Headed sections, text only, readable before booking. No tick box, because the booking snapshot already records what the customer saw. |
| 4 | Positioning | The booking link first, the marketplace later. A provider brief before more outreach. |
| 5 | Alpha price | Keep what the agreement says (2%, no subscription). Stop mentioning subscriptions until tested. Ask about price in every interview. |
| 6 | Name | A five-person hearing test this week. |
| 7 | First live provider | C, once the before-alpha list is closed and production is promoted. |

## Where each provider stands, and the next three weeks

| When | Provider | What it takes |
|---|---|---|
| Now | C | Close the before-alpha list and promote production (owner steps). Set C's page up with C. Weekly hours and blocked dates roughly fit C's routine, though the following month shows early until #1 exists. Start at C's October release if everything is ready, otherwise November's. |
| 8 October | – | Go or no-go on drop availability. If it isn't on Preview by then, agree the workaround with B, or move B's trial to the 15 November drop. |
| 15 October, 7 pm | B | #1 (or the fallback), #2, a drop rehearsal on Preview, and the brief B asked for. |
| 17 October | A | #1 and #3. A also asked for #2, #9 and booking questions, so A's trial may suit the November drop better. |
| When D's Acuity month ends | D | Nothing new. Asked what else they wanted, D said "it looks really good actually". |
