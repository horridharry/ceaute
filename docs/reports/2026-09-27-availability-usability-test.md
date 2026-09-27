# Availability usability test: one ex-provider, desktop

Date: 27 September 2026. Source: the product owner's notes from one moderated
session with a former beauty provider, on the desktop site running locally,
the same day drops reached Preview
([decision 007](../decisions/007-availability-released-in-drops.md)). The
repository is public, so the participant is "the provider" and no personal
details are kept here.

## What was tested

The Availability screen as built on 27 September: drops shown as summary
cards, an editor that opened in place on the same page, a month calendar,
typed times with suggestions, and Now or Later for the drop time.

1. **Unprompted:** starting on Today, with drops already set, "add some slots".
2. **Set task, after the owner cleared the existing drops:** set November
   slots to open on 16 October at 7 pm.

## Findings

### 1. Finding Availability: no problem

The provider asked "Where shall I do this?", then within a few seconds opened
the dashboard menu and reached Availability unaided.

### 2. Back did not return from the editor (changed)

With drops already on the screen and no clear next step, the provider pressed
Edit on an existing drop. To leave, they pressed the browser's Back button,
which did not take them back to the list, and asked "How do I leave this?".

They read Edit as opening a separate page. The editor opened in place on the
same address, so Back either left Availability entirely or, with unsaved
changes, stayed and asked. **Decided the same day by the owner:** editing a
drop and adding one open their own pages (`/dashboard/availability/<drop>/edit`
and `/dashboard/availability/new`), as Treatments do, so Back, Cancel and Save
return to the list.

### 3. The set task succeeded

The provider set November slots to open on 16 October at 7 pm without help.

### 4. Premium early slots (research, not decided)

While choosing times: "I want to begin at 10 to finish at 6, but I would like
premium slots before 10 am for my really important customers." This could
mean times only chosen customers can book, times anyone can book for a higher
price, or both. One provider said it once. It is deferred and listed in the
product-design skill's `references/undecided.md`. Ask about it in the next
interviews before designing anything.

### 5. "See what it looks like" after saving (research, not decided)

After saving, the provider wanted to see how the result looked. It is not
known whether they meant the storefront, the booking screen or a summary of
the drop, or whether the existing link to their own page would satisfy it.
Also deferred to `references/undecided.md`.

## Limits

One participant, on desktop only, moderated by the owner, on a local build.
The first task began from existing drops that the participant had not made,
which may have made Edit look like the way in. The notes are the owner's
summary, not a transcript.
