# Design system

The shared visual foundation: colour tokens, the light-only baseline, and the
primitives in `src/components/ui`. It records what exists and how to use it.
Product and interaction decisions come from the `ceaute-product-design` skill
(`.claude/skills/ceaute-product-design`); this file does not replace them. The
brand palette, typography and motion language are still undecided, so nothing
here is a brand system.

Stage 1 of the redesign built the foundation and adopted it on a few screens
only: All reviews, Account bookings, the dashboard Add-ons list and form, the
not-found and route-error screens, and every `loading` file. Other screens
still use hand-written classes and move over during their own journey
redesigns (customer booking, dashboard shell, provider sections). Do not
migrate a screen just to use a primitive.

## Colour tokens

Defined with `@theme inline` in `src/app/globals.css`. Each token is the exact
colour the code already used for that role, so adopting one changes nothing on
screen. Near-identical values were kept apart rather than merged.

| Token | Value | Role |
| --- | --- | --- |
| `ink` | black | Primary text |
| `ink-muted` | black/60 | Secondary text, hints, empty states |
| `ink-subtle` | black/50 | Tertiary text (counts, references) |
| `surface` | white | Page and card background |
| `surface-subtle` | black/5 | Placeholders, skeletons, hover fills |
| `line` | black/10 | Default borders |
| `line-strong` | black/20 | Hover borders |
| `action` | pink-700 | Primary button fill |
| `action-strong` | pink-800 | Primary hover; standalone page actions |
| `accent` | pink-600 | Links and pink text actions |
| `accent-strong` | pink-700 | Hover of `accent` text |
| `focus` | pink-600 | Keyboard focus rings |
| `field-focus`, `field-focus-ring` | pink-500, pink-100 | Text field focus border and ring |
| `danger`, `danger-line` | red-600, red-200 | Error text and borders |
| `destructive`, `destructive-surface` | rose-600, rose-50 | Archive and remove actions |
| `scrim` | black/40 | Dialog backdrops |

Write `text-ink-muted`, not `text-black/60`, in new or migrated code. For a
one-off shade use the token with an opacity modifier (`text-ink/90`) instead of
adding a token. Values not yet named (black/55, black/70, red-700 and others)
stay as they are until a screen that uses them is redesigned; naming or merging
them is a visual decision, not a refactor.

## Light-only baseline

`html` declares `color-scheme: light` and paints `bg-surface text-ink`; `body`
paints `bg-surface`. The viewport metadata in `src/app/layout.tsx` sets a white
`themeColor` for both OS themes and `colorScheme: "light"`. Ceaute has no dark
theme; do not add `dark:` styles. The viewport has no scale limit, so people
can pinch-zoom; keep text inputs at 16px (`.field` does) so iOS does not zoom
on focus.

## Primitives

All live in `src/components/ui`. Each has a plain class helper beside it
(`button-classes.js`, `layout-classes.js`, `field-props.js`), so a link or a
layout can share the rule, and so the tests can check it.

### Button and buttonClassName

`<Button variant size surface>` renders a native `<button>` and leaves `type`
to the caller. For a link that looks like a button, use
`buttonClassName({ variant, size, surface, className })` on `<Link>`.

| Variant | Use for |
| --- | --- |
| `primary` | The main action of a form or screen (pink-700 fill) |
| `primary-strong` | A standalone page action: error pages, sign-in (pink-800 fill) |
| `ink` | The storefront's Book and Choose a time: filled black, so provider photos carry the colour |
| `secondary` | A second action beside a primary one (outlined, pink text) |
| `outline` | A neutral full-width "See all" style action (outlined, dark text) |
| `destructive` | Archive, remove, cancel-this-thing |
| `text` | A pink text action with no box |

Sizes: `md` (default, at least 44px tall), `compact` (for established dense rows
only; keep enough space around it) and `icon` (a 44px square that must have an
`aria-label`). Pass `surface="image"` over photos so the focus ring is white.
Every variant has a visible `focus-visible` ring, disabled styling, and stops
transitions under reduced motion.

### PendingButton

`@/components/ui/pending-button` is the one implementation: a submit button
that disables itself, sets `aria-busy` and shows `pendingLabel` while its form
submits. It takes Button's variants. `@/components/pending-button` is a
compatibility wrapper that renders the same button with only the caller's
classes, so checkout and the other existing consumers needed no edits.

### Forms

- `Field` renders the label, an optional `hint`, an `error`, and the control.
  Pass the control as a function to have it wired up:
  `{(control) => <Input {...control} name="price" required />}` gives it the
  id, `aria-invalid` and an `aria-describedby` that points at the hint and
  error. `FormField` in the dashboard is the same component under its old name.
- Mark a field `optional` only when its validation really lets it be empty; it
  then reads "(optional)". Required fields carry no marker or asterisk.
  `OptionalMarker` does the same for a `<legend>`.
- `Input`, `Select`, `Textarea` and `Checkbox` style the native elements.
- Field errors are not live regions; they are read with their control. Use
  `FormError` (an alert) for a form-level or save error and `FormStatus` (a
  polite status) for progress or success.

### Page structure

- `PageContainer` is the page's `<main>`: `width` is `narrow` (default),
  `column` (storefront sub-pages), `wide` (gallery), `prose` (legal text) or
  `auth`. It centres the page on desktop; `align="start"` keeps the old
  left-aligned placement for loading states of pages not yet redesigned. Use
  `as="div"` if a layout already provides `<main>`.
- `PageHeading` is the page's only `<h1>`: `size="lg"` for page titles
  (Bookings, Add-ons), `size="md"` for sub-page and card titles, with an
  optional `back={{ href, label }}` link, `description` and `action`.
  `tracking="tight"` keeps the error-page letter spacing. Section titles below
  it are `<h2>`, and items inside a section are `<h3>`. The dashboard's
  `SectionHeading` is PageHeading with its "+ New" action.
- `Card` groups related content (`padding` `sm`, `md` or `lg`). `CardLink` is a
  card that is one link: the link takes focus and the card shows hover. Put no
  other interactive element inside a CardLink. Use a card when the border adds
  grouping or a tap target, not around every item.
- `EmptyState` is the text a list shows when it is empty: `inline` or
  `bounded`, with an optional action. Keep the wording plain.
- `Skeleton`, `SkeletonGroup` and `PageSkeleton` build loading states. A group
  is announced once as "Loading", hides its blocks from assistive technology,
  and only pulses when reduced motion is not requested.

`border="current"` on Card and EmptyState draws the border in the text colour.
Only Account bookings uses it: a bare `border` in Tailwind 4 takes the text
colour, and that page has always looked that way. Whether it should use
`line` instead is a visual decision for the customer-booking redesign.

### Dashboard patterns

Added by the provider dashboard redesign; tested in
`tests/dashboard-primitives.test.js`.

- `LinkFilterPills` and `ToggleFilterPills` are one row of filter pills with
  one selected. Use link pills when the filter lives in the URL (Bookings
  `?view=`, Add-ons and Treatment groups `?status=`); they carry
  `aria-current="page"`. Use toggle pills for page-only state; they carry
  `aria-pressed`. An optional `count` shows beside the label. The storefront's
  treatment-group filter uses the same component.
- `ActionMenu` holds a row's secondary actions behind a 44px "more" button
  labelled with the item's name ("Actions for Gel removal"). It is a
  disclosure of real buttons and links, not an ARIA menu. Opening focuses the
  first action; Escape closes it and returns focus to the trigger. A disabled
  action shows its reason underneath ("Archive first to delete"), linked by
  `aria-describedby`. Destructive actions come last, after `separatorBefore`.
- `ConfirmDialog` is the native `<dialog>` pattern of the Availability
  closed-week dialog. The safe choice comes first and takes focus, and Escape
  means the safe choice. The confirm button is `destructive-strong` for
  irreversible actions and `primary` otherwise. Errors stay inside the dialog.
  `blocked` shows an explanation with only OK. Focus returns to the opener,
  or to `fallbackFocusRef` if the opener has gone.
- `Badge` is a neutral pill. `attention` adds a pink dot and `live` a green
  one; `quiet` is for secondary facts. Never use it to repeat the state a
  filtered list already shows.
- `FormActions` ends every create and edit form: one right-aligned primary
  submit (the Booking settings pattern) and an optional neutral `FormStatus`.
  `discardHref` adds Discard (an outline link back to the list) before the
  submit. Pair it with `useFormUnsavedGuard({ pending })`
  (`components/unsaved-changes`), whose `formProps` go on the `<form>`: the
  guard asks "Discard changes?" only when the form's values differ from what
  it loaded, and it steps aside on submit.
- `HistoryFilterViews` (`components/history-filter-views.jsx`) is filter pills
  over views already rendered on the page: switching is instant, and each
  choice is a `pushState` history entry so the URL, Back and Forward work.
  Bookings and My bookings use it; other URL filters still use
  `LinkFilterPills`.
- `Disclosure` is a styled `<details>` for secondary content: archived
  treatments, the cancellation policy, and payment fees.
- Button `destructive-strong` is the filled confirm of an irreversible action.
  PageContainer `medium` (`max-w-2xl`) is used only by the portfolio grid.
- `Field` puts the label 6px above the control, the hint between them, and
  the error below the control, only when there is one.
- `Notice` is a boxed message about the state of something, not about a form:
  `attention` (amber) when the person has something to do, such as a paused
  page or booking terms saved before percentages; `neutral` for a fact, such
  as a provider not taking online bookings. It is a `status` by default; pass
  `role="alert"` only for something that just happened (a time that was just
  taken) and `role={null}` inside a region that is already announced.

In the dashboard, `DashboardPage` (a centred container plus the heading with
description and "New" link) frames every screen, and `ManagementRow` is an
edit link with its `ActionMenu` beside it, never inside it.

The setup guide (`dashboard/_components/setup-guide.jsx`) is the one floating
element. Compact, it is pinned to the bottom on phones (with the safe-area
inset) and floats 320px wide at the bottom right from 640px; the body is
padded by `--guide-space` so it never covers the last control. Expanded, it is
a full-screen modal `<dialog>` on phones and a non-modal 384px panel from 640px
(Escape collapses both). It has no animation under reduced motion.

Customer booking screens keep their one primary action in a bar stuck to the
bottom of the screen on phones (Review and pay, the held page), padded by the
safe-area inset, and in the page flow from 640px.

## Accessibility conventions

- Every interactive element shows a focus ring on keyboard focus
  (`focus-visible`, the `focus` token, 2px with a 2px offset; white on photos).
- Primary actions and icon controls are at least 44px tall. Compact text
  actions are allowed in dense rows but must not crowd their neighbours.
- One `<main>` and one `<h1>` per page, with headings in order below it.
- Hints and errors are connected to their control; form-level errors are
  announced once; loading is announced once.
- Motion stops under `prefers-reduced-motion`.

## Where a change belongs

A change to a token, a primitive's look or an accessibility convention belongs
here and in `src/components/ui`, with its test in
`tests/design-system-primitives.test.js`. A change to one screen's design
belongs in that screen, using these primitives, as part of its journey's
redesign.
