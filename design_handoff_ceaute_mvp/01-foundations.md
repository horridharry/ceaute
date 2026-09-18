# 01 · Foundations

Everything in `02-components.md` and `03-screens.md` assumes these values. Where a design
does not specify something, use the scale here rather than inventing a value.

Source: `Ceaute MVP Spec.dc.html` §1.

---

## Colour — five values

The whole product uses five colours plus alpha-derived greys. There is no secondary
accent, no tint of the accent, and no gradient anywhere except the scrim over a hero
photograph.

| Token | Hex | Used for |
| --- | --- | --- |
| `ink` | `#0B0B0B` | All text. Selected chips and day/slot cells. Secondary buttons. |
| `plum` | `#8C2B52` | Primary button, links, focus ring, the "Confirmed" status dot, the eyebrow label on letter screens. |
| `surface` | `#F4F3F1` | Input fill on search only, treatment rows, segmented-control track, the framed panel inside a letter screen. |
| `green` | `#2F6F4F` | "Active", "Completed", "Payments ready", a settled refund. |
| `red` | `#B3261E` | Destructive actions, validation errors, "Restricted", a failed refund. |

Amber `#C98A1A` is permitted **only** for genuinely pending states: a refund in transit,
incomplete Stripe onboarding, a payment still processing. It is not a warning colour and
never appears as a background fill. Amber `#7A5410` text on a dashed `rgba(201,138,26,.55)`
border is used for the Owner TODO callouts on legal pages and nowhere else.

### Greys are ink at alpha

Do not introduce grey hex values. Every grey is `#0B0B0B` at an opacity:

| Name | Value | Used for |
| --- | --- | --- |
| `text-2` | `rgba(0,0,0,.80)` | Body copy on legal and long-form pages |
| `text-3` | `rgba(0,0,0,.60)` | Secondary sentences, descriptions |
| `text-4` | `rgba(0,0,0,.50)` | Meta lines (place · rating · duration) |
| `text-5` | `rgba(0,0,0,.45)` | Section labels, helper text, placeholders |
| `border` | `rgba(0,0,0,.12)` | Card and row borders |
| `border-strong` | `rgba(0,0,0,.16)` | Input borders, tertiary button borders |
| `hairline` | `rgba(0,0,0,.08)` | Dividers inside a card, section separators |

### What was removed, and why it matters

The previous iteration had a sixth colour, `plum-tint` `#F7EDF1`, used behind the held-slot
banner and inside status pills. It is gone. Plum is used at full strength or not at all —
a tinted accent reads as generic SaaS. Anywhere you find `#F7EDF1` in older mockups,
replace it with a hairline border or the neutral `surface`.

### Tailwind

The current code uses `pink-600`, `pink-700` and `pink-800` throughout. Add the accent to
the theme and replace every one of those occurrences:

```js
// tailwind.config — or @theme in globals.css for Tailwind 4
colors: {
  ink:     '#0B0B0B',
  plum:    { DEFAULT: '#8C2B52', hover: '#6F2141' },
  surface: '#F4F3F1',
  ok:      '#2F6F4F',
  bad:     '#B3261E',
  pending: '#C98A1A',
}
```

Grep for `pink-` before you consider this done; there are roughly forty call sites across
auth forms, the dashboard nav, the storefront and every action button.

---

## Type — Geist only, seven steps

| Step | Spec | Used for |
| --- | --- | --- |
| `display` | 600 · 27px / 1.1 · `-0.035em` | Page titles (`Bookings`, `Treatments`, `Discover`) |
| `title` | 600 · 24px / 1.1 · `-0.035em` | Detail-screen titles |
| `letter` | 600 · 30px / 1.12 · `-0.04em` | The headline on a letter screen only (Confirmed, Published, Cancelled) |
| `heading` | 600 · 16px · `-0.02em` | Section headings inside a screen |
| `body-strong` | 500 · 14.5px | Row titles, input values |
| `body` | 400 · 13.5px / 1.55 | Descriptions, policies, helper sentences |
| `meta` | 400 · 12.5px · `text-4` | `Nails · Manchester · 5.0 (12)` |
| `label` | 500 · 11.5px · `+0.06em` · uppercase · `text-5` | Group labels, section eyebrows |

Long-form pages (`/terms`, `/privacy`) step body up to **400 · 14.5px / 1.65** in a 600px
measure. That is reading, not scanning, and the shorter app line height is too tight for it.

Minimum size anywhere in the product: 11px. Minimum tap target: 44px.

`text-wrap: pretty` on every headline of `heading` size or larger.

---

## Space

| Use | Value |
| --- | --- |
| Page gutter (mobile) | 20px |
| Page gutter (letter screens) | 24px |
| Between stacked cards or rows | 8px |
| Between sections | 24px + a `hairline` rule |
| Label → control | 6px |
| Between form fields | 13px |
| Card padding | 13px 14px |
| Email card padding | 36px |

Lay every sibling group out with flex or grid and `gap`. Do not space items with
per-element margins or source whitespace.

## Radius

| Element | Value |
| --- | --- |
| Input, slot cell, small button | 10px |
| Row, treatment row, segment | 12px |
| Card, booking card, panel | 14px |
| Provider card, framed letter panel, modal | 16–18px |
| Pill, chip, avatar | 999px / 50% |
| Phone frame (mockups only) | 30px |

## Elevation

**No shadows on cards.** Shadow is reserved for things that float above the page: modals
(`0 18px 48px rgba(0,0,0,.18)`) and the desktop popover
(`0 12px 32px rgba(0,0,0,.14)`). A card sitting in the page flow gets a border, never a
shadow. No gradients except the scrim over a hero image.

## Motion

Sparing and short. 150–200ms, `ease-out`, on: modal and sheet entry, chip and slot
selection, button press. The countdown on a held slot ticks once per second with no
animation. Nothing else animates. No page-transition effects, no skeleton shimmer.

## Loading

**No skeleton screens, no spinners on page load.** Pages are server-rendered and paint. A
spinner appears only inside a button that is committing an action, where the label is
replaced by a 16px spinner and the button width is held fixed to stop layout shift. The
existing `LinkPendingHint` and `PendingButton` components already do the right thing;
keep them and restyle.

The one exception is the post-Stripe interstitial (`03-screens.md` → *Confirming your
booking*), which is a genuine wait on a webhook and says so in words.

## Fixed product constants

These come from `docs/product.md` and are **not** provider-configurable. Designs assume
them; do not add settings for them.

- 15-minute slot grid
- 24-hour minimum booking notice
- 60-day booking window
- `Europe/London` throughout
- One continuous working period per weekday, plus whole blocked dates
- Slot hold: 5 minutes at creation, extended to the Stripe Checkout expiry (~31 min) once
  Checkout opens
