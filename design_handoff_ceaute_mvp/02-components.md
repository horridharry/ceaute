# 02 · Components

Every component in the product, with its states. A screen is only ever these parts
arranged into one of the five templates in `03-screens.md`.

Build these first, in roughly this order. Once they exist, the screens are assembly.

Source: `Ceaute MVP Spec.dc.html` §2.

---

## Buttons

Height 48px. Radius 11px. Label 500 · 14.5px.

| Variant | Style | Rule |
| --- | --- | --- |
| Primary | `plum` fill, white label, 600 weight | **One per screen.** The thing the screen is for. |
| Secondary | `ink` fill, white label | A second action of equal weight (Directions, Open booking) |
| Tertiary | 1px `border-strong`, ink label | Anything else |
| Destructive | 1px `rgba(179,38,30,.35)` border, `red` label | Cancel, delete. **Never a red fill** except the final confirm inside a cancel flow. |
| Disabled | Primary at 40% opacity | Invalid form, incomplete code |
| Text | 500 · 13.5–14px, `text-3`, no border | Quiet exits ("Keep booking", "Not yet") |
| Inline link | 500 · 13px, `plum`, no underline | Inside a sentence or a row |

A primary button that **commits** something (Book, Pay, Save, Hold) is pinned to a bottom
commit bar. A primary that merely navigates sits inline.

Pairs are a flex row with `gap: 8px` and `flex: 1` on each child.

### Loading

Replace the label with a 16px spinner, hold the width. Do not disable and grey out
without feedback — the existing `PendingButton` already handles the pattern.

---

## Inputs

Label above at 500 · 12.5px, 6px gap. White fill. 1px `border-strong`. Radius 10px.
Padding 12px 13px. Value at 400 · 14px.

| State | Change |
| --- | --- |
| Placeholder | Value colour `rgba(0,0,0,.35)` |
| Focus | Border becomes **1.5px `plum`**; reduce padding by 0.5px to hold size |
| Error | Border 1.5px `red`; message below at 400 · 11.5px `red` |
| Disabled | 50% opacity, no border change |

Helper text: 400 · 11.5px `text-5`, 5px below the field. **At most one helper line per
screen.** If a field needs explaining, the field is wrong — this was a repeated review
note and it matters.

Optional fields are marked with a suffix on the label — `Description — optional` in 400
weight `text-5` — never an asterisk on required ones.

### Field types

- **Text / email** — as above.
- **Multiline** — grows to 6 lines then scrolls. `400 · 13.5px / 1.5`.
- **Price** — numeric keypad, `£` fixed as a prefix, two decimals applied on blur.
- **Duration** — a **select**, never free text. 15-minute steps from 15m to 8h, displayed
  as `2h 15m`. Native `<select>` on mobile (the OS wheel), a popover list on desktop.
  The same control handles an add-on's "adds to time", from 0 to 2h. This guarantees a
  duration can never misalign with the 15-minute slot grid.
- **Select** — same box, chevron `⌄` at `text-5` on the right.
- **Search** — the one filled input: `surface` fill, no border, no label, radius 11px, a
  13px circle outline as the leading glyph.
- **Pair** — side by side only for price + duration and city + postcode. Everything else
  is one per row.
- **Code entry** — six cells in a row, centred, 600 · 26px, `+0.1em`, tabular numerals,
  inside a single 1.5px `plum` focus box. Unfilled positions show a `rgba(0,0,0,.2)`
  centre dot. Continue stays disabled until all six are present.

---

## Selection

### Chips
`500 · 12.5px`, padding 8px 13px, radius 999px, wrap freely.
Selected: `ink` fill, white label. Default: 1px `rgba(0,0,0,.14)` border.
A count appends to the label — `Toes 4`, not a separate badge.
An action chip (`+ New group`) uses a `rgba(140,43,82,.35)` border and `plum` label.

### Segmented control
2–3 options, one row, `surface` track with 3px padding. The active segment is a white
card with radius 9px and `0 1px 3px rgba(0,0,0,.08)` — the only place a small shadow is
allowed, because it has to read as raised inside the track.

### Tabs
Switch list content in place. `500 · 13px`, 18px gap, a `1.5px ink` underline on the
active tab, `text-5` on the rest, sitting on a `hairline` bottom border.

### Option cards
When each choice needs a line of explanation (payment mode, cancellation window).
Two side by side, radius 12px. Selected gets a **1.5px `plum`** border, not a fill.
Title `500 · 14px`, explanation `400 · 12px` `text-3`.

### Toggle and checkbox
Toggle: 38 × 22px, radius 999px, `plum` when on, `rgba(0,0,0,.14)` when off, 18px white
knob with 2px inset.
Checkbox: 20 × 20px, radius 5px, `plum` fill with a white check when on, 1.5px
`rgba(0,0,0,.25)` border when off.

### Day strip
Five days visible with a month header above carrying prev/next circular controls. Each
cell: `flex: 1`, radius 11px, padding 11px 0, day abbreviation at 500 · 11px `text-4` over
the date at 600 · 17px. Selected inverts to `ink`/white. A closed day is **35% opacity** —
never struck through, never hidden.

Do not show seven days. Reviewers consistently read a full week as too much at once.

### Slot grid
Three per row, `gap: 8px`. Cell: radius 11px, padding 14px 0, `500 · 15px`, centred.
Selected inverts to `ink`/white. Only bookable starts appear — a start that cannot fit the
treatment duration before closing time is simply absent, with **no explanatory caption**.

---

## Rows — three kinds

### Treatment row
`surface` fill, **no border**, radius 12px, padding 13px 14px. Flex, centred.
Left: name at `500 · 14.5px`, and beneath it `duration · price` at `400 · 12.5px` `text-3`.
Right: a single **`ink` pill** labelled `Select` — 600 · 12.5px, padding 9px 14px, radius 999px.

The whole row is the tap target; the pill is the affordance. **The right-hand side holds
one button and nothing else** — an earlier version stacked price, duration and a link
there and it read as clutter.

The treatment description does **not** appear on the row. It lives in the detail sheet.

### Add-on row
Inside a bordered container, radius 12px, rows separated by `hairline`.
Left: name at `400 · 14px`, delta beneath at `400 · 12px` `text-3` — `+ £3` or
`+ £3 · + 5 min`. Right: the checkbox.
Beyond five add-ons, collapse with a `Show N more` row in `plum`.

### Setting row
1px `border`, radius 14px, padding 13px 14px.
Left: title `500 · 14px`, current value beneath at `400 · 13px` `text-3`.
Right: either an `Edit` link in `plum`, or a `→` chevron if it navigates.

Treatment rows are filled so they read as tappable products; everything else is outlined.

---

## Cards — four kinds

### Provider card
The only card with a photograph. Radius 16px, 1px `border`, image flush to the top edge at
150px tall, `object-fit: cover`.
Body padding 11px 14px 12px. Name `600 · 16px` `-0.025em`.
**Rating leads the meta**: `★ 5.0 · 12 reviews` at `500 · 13px` in full ink, with
`Lashes · Manchester` beneath at `400 · 12.5px` `text-4`.
Right-aligned: price at `500 · 14.5px` over the word `from` at `400 · 11.5px` `text-5`.
A provider with no reviews shows `New · no reviews yet` in place of the rating.

Reviews lead because trust is the whole problem on a marketplace of strangers.

### Booking card
1px `border`, radius 14px, padding 13px 14px. Flex with `gap: 13px`.
Left column, 44px wide: weekday at `500 · 11px` `text-5` over the date at
`600 · 19px` `-0.02em`.
Right: title and amount on one line, meta beneath, then the status.

### Review card
1px `border`, radius 12px. Name and rating as `Shanice · 5/5` at `500 · 13.5px`; date and
treatment right-aligned at `400 · 12px` `text-5`; comment beneath at `400 · 13px / 1.5`
`text-2`.
**First name only, always** — the schema stores it that way.

### Summary card
1px `border`, radius 14px, padding 2px 14px. Each line is a flex row with 10px vertical
padding and a `hairline` bottom border; the last line has no border and steps up to
`500 · 15px`.

---

## Status

### Status = a dot plus a word
**No pills, no tinted backgrounds.** A 7px dot and a `500 · 12px` label in the dot's colour.

| Status | Dot |
| --- | --- |
| Confirmed | `plum` |
| Active, Completed, Refund recorded | `green` |
| Awaiting payment, Cancelled, Hold expired, Archived | `rgba(0,0,0,.30)` with `text-3` label |
| Refund processing, Stripe incomplete | `pending` |
| Refund failed, Restricted | `red` |

The earlier pill-with-tinted-background treatment was cut for looking generic.

### Held row
Sticky beneath the nav during a booking. **A hairline row, not a banner** — no fill, no
tint. `border-bottom: 1px hairline`, padding 10px 0.
Reads as a sentence: `Wed 23 Sep, 11:45 is yours for` … `4:12 min` in `plum` with tabular
numerals.

### Notices
In-page, never a toast.
- **Informational** — a `surface` block, radius 12px, padding 13px 14px, `400 · 13px / 1.55`.
  Used for a provider's written policy.
- **Problem** — a hairline row top and bottom with a `red` (or `pending`) dot, a
  `500 · 13.5px` title and a `400 · 12.5px / 1.55` explanation. **Never a red or pink
  filled box.**

### Empty state
A `heading`, one `body` sentence, one `plum` link. No illustration, no card.

> **No bookings yet**
> When you book someone, it shows here with the address and what's due.
> Find someone →

---

## Navigation

### Top bar — 52px, three variants

1. **Root** — wordmark left (`600 · 16px`, `-0.03em`, always "Ceaute" in sentence case,
   never letterspaced or monospaced), avatar right. Signed out shows a `Log in` text link
   instead of the avatar.
2. **Stacked** — back control left, step counter right (`500 · 12px` `text-5`).
   The back control is a `plum` chevron `‹` at 17px plus the parent's name at `500 · 14px`
   in plum — the same treatment as every other link, so it reads as tappable. An earlier
   version used a 32px outlined circle; it was cut for looking like a new component.
3. **Modal** — `Cancel` left, title centred at `600 · 14px`, `Save` right. Save is a
   duplicate of the commit bar's primary and stays disabled until the form is valid.

The avatar is the only top-right control a customer ever sees, and it is **never** the way
out of a task — exits live in the bottom third, within thumb reach.

### Customer avatar menu
A popover from the top right, 210px wide, radius 14px, `0 12px 32px rgba(0,0,0,.14)`,
6px padding. Items at `500 · 14px`, padding 11px 12px.
`Bookings` · `Account` · divider · `Your page` (with a `plum` "Provider" label when they
have one) · `Log out` in `text-3`.

### Provider nav — a visible strip
**Not a hidden menu and not a floating pill.** A horizontal strip directly beneath the top
bar: `Today` · `Bookings` · `Treatments` · `Page` · `Settings`.
Items `500 · 13.5px`, padding 10px 9px 12px, `gap: 2px`, active carries a `2px ink`
underline, the rest are `text-4`. The strip scrolls horizontally on narrow screens and
sits on a `hairline` bottom border.

Groups and add-ons are tabs **inside** Treatments; location and hours are **inside** Page.
That collapses the current eight-item drawer to five.

On desktop the same five items become a left column.

A provider works two-handed between clients — a strip she can see beats a menu she has to
open. There is **no bottom tab bar anywhere**; this is a web app.

### Commit bar
Pinned to the bottom, `hairline` top border, padding 12px 20px 24px.
Either a full-width primary, or a flex row with context on the left (price at `500 · 14px`
over a `400 · 11.5px` `text-3` line) and the primary on the right.
