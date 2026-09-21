# Frontend restructuring baseline — 21 September 2026

The reference record for the frontend restructuring of `src/app` and
`src/components`. Sections 1-9 are the read-only Wave A baseline, captured on
branch `architecture/frontend-restructure` at commit `e7cc76a` before any
application code was changed. Section 10 records the decisions the product
owner approved after Wave A. Section 11 records what Wave B landed and the
remaining wave order.

Later waves are checked against this document, so it is not edited after the
date except to append the outcome of a completed wave.

## 1. Chrome decision rules (the thing task 4 must preserve)

Root layout src/app/layout.tsx:29-35 renders <AppHeader /> {children} <SiteFooter />.
AppHeader (src/components/app-header/app-header.jsx:8,18) reads at request time:
  - getRequestSession() -> supabase.auth.getClaims()
  - getOwnedProviderPage(userId) -> ceaute.provider_page where owner_profile_id = userId
  Both React cache()d in src/lib/auth/request-session.js.

RULE H1 app-header-client.jsx:11,149  header returns null
  hiddenHeaderPrefixes = ["/sign-in", "/sign-up", "/verify", "/auth"]  (startsWith)

RULE H2 app-header-client.jsx:13-17,153  header returns null
  /^\/dashboard\/treatment-groups\/(?:new|[^/]+\/edit)$/
  /^\/dashboard\/add-ons\/(?:new|[^/]+\/edit)$/
  /^\/dashboard\/locations\/(?:new|[^/]+\/edit)$/
  NOTE: /dashboard/treatments/new and /dashboard/treatments/[id]/edit are NOT listed.

RULE H3 app-header-client.jsx:143-147  provider-workspace header variant
  user && providerPage && (pathname.startsWith("/dashboard") || pathname === "/account/settings")

RULE H4 app-header-client.jsx:161  logo href is session dependent
  <HomeLogo href={user ? "/discover" : "/"} />

RULE H5 app-header-client.jsx:29-31  HeaderLink active
  exact ? pathname === href : pathname === href || pathname.startsWith(href + "/")

RULE H6 provider-navigation.jsx:7-45  ProviderNavigation items and active test
  Today     ["/dashboard"]                      exact match only
  Bookings  ["/dashboard/bookings"]
  Treatments["/dashboard/treatments", "/dashboard/treatment-groups", "/dashboard/add-ons"]
  Page      ["/dashboard/profile", "/dashboard/availability", "/dashboard/locations"]
  Settings  ["/dashboard/settings", "/account/settings"]
  Desktop: centered absolute block (md:block). Mobile: second <nav aria-label="Provider"> row (md:hidden).

RULE F1 site-footer.jsx:8-14  footer hidden
  startsWith /dashboard | /sign-in | /sign-up | /verify | /auth  OR  pathname.includes("/book/")

Signed-in non-provider header links: Discover /discover, Bookings /account/bookings, Account /account (exact).
Signed-out: single "Log in" -> /sign-in.
AccountMenu branches on hasProviderPage (app-header-client.jsx:49,73-124).
Logout: logoutUser from @/app/(authenticate)/actions  (actions.js:188-192, aliased as signOut at :194).

## 2. Route inventory deltas vs the audit
- Route group (site) EXISTS and the audit omitted it: /privacy, /terms, src/app/(site)/_components/legal-page.jsx.
- Also outside the audit: / (src/app/page.tsx), /auth/error, /auth/confirm, error.tsx, not-found.tsx,
  and 6 loading.* boundaries that carry their own container class strings.
- Layouts: only 4 exist. root (real UI); (account)/account (children only);
  (dashboard)/dashboard (children only); (public-provider)/[username] (notFound guard, then children).
  (authenticate) and (site) have NO layout.
- The dynamic segment folder is [username], not @[username]; the leading "@" is enforced in code by
  hasPublicUsernamePrefix (public-provider-format.js:1-3) via notFound().
- Build emits 46 routes, all dynamic (f). No static/ISR routes.
- Empty untracked dir: src/app/(dashboard)/dashboard/treatments-ui-qa/ (0 files, no route).

## 3. Section navigation (repeated, layout-less)
CatalogueSectionNav  _components/catalogue-section-nav.jsx  "use client"
  rendered by treatments-page.jsx:62, treatment-groups-page.jsx:98, treatment-add-ons-page.jsx:91
  items: Treatments /dashboard/treatments | Groups /dashboard/treatment-groups | Add-ons /dashboard/add-ons
  renders <h1>Catalogue</h1> (:37) and ariaLabel="Catalogue" (:47)  <- visible copy, see open decision
PageSectionNav       _components/page-section-nav.jsx        "use client"
  rendered by profile/page.jsx:19, portfolio-page-ui.jsx:168, preview/page.jsx:16,
              availability-form.jsx:122, locations-page.jsx:116
  items: Profile(exact) | Portfolio | Availability | Locations | Preview
SettingsSectionNav   _components/settings-section-nav.jsx    "use client"
  rendered by account/settings/page.jsx:35 (provider branch only), settings/payments/page.jsx:97,
              booking-settings-form.jsx:47.  NOT rendered by dashboard/settings/page.jsx.
  items: Account /account/settings | Booking settings | Payments
SectionTabs          _components/section-tabs.jsx            server
FocusedTaskHeader    _components/focused-task-header.jsx     server
  used by treatment-group-form, treatment-add-on-form, location-form-ui — the 6 routes hidden by RULE H2.
  Treatments new/edit does NOT use it (treatment-form.jsx:96-97 renders a plain <h1>).

## 4. Page shell inventory
9 distinct top-level container strings; `container max-w-md p-5` appears in 23 files.
41 <main> occurrences across 40 files.
CONFIRMED double <main>: /dashboard/profile renders profile/page.jsx:17 and, as a sibling in the same
fragment, provider-page-form.jsx:66. Two <main> landmarks on one route.
REFUTED: checkout/page.jsx:333 and :560 are mutually exclusive returns of one function, not nested.

## 5. Cross-route imports (task 3 / task 15 target list) - COMPLETE
alias imports:
  (account)/account/settings/page.jsx:8   -> @/app/(dashboard)/dashboard/_components/settings-section-nav
  (dashboard)/dashboard/profile/preview/page.jsx:1 -> @/app/(public-provider)/[username]/_components/storefront-page
  (dashboard)/dashboard/profile/preview/page.jsx:2 -> @/app/(public-provider)/[username]/_lib/storefront-view-model
  src/components/app-header/app-header-client.jsx:6 -> @/app/(authenticate)/actions
relative imports escaping a route:
  discover/page.jsx:8 -> ../(public-provider)/[username]/_lib/public-provider-format  (formatPricePence)
  (dashboard)/dashboard/page.jsx:3 -> ./bookings/actions (getAllBookings)
  book/_lib/appointment-availability.js:1 -> ../../../../../lib/bookings/appointment-grid.js

Status after Wave B (task 1, commit 97dd17f):
  RESOLVED  discover/page.jsx:8 - now imports @/features/storefront/format.
  REMAINING task 3: the three alias imports above (settings-section-nav,
            storefront-page + storefront-view-model, logoutUser).
  REMAINING task 9b: (dashboard)/dashboard/page.jsx -> ./bookings/actions (intra-group).
  OUT OF SCOPE: book/_lib -> src/lib/bookings/appointment-grid.js is a route
            importing shared lib code, which is the intended direction.

## 6. Client components: 28 files (the audit said 30)
See `grep -rln '"use client"' src`. Notable: treatment-groups-page.jsx and treatment-add-ons-page.jsx
are client; treatments-page.jsx is NOT.

## 7. CRITICAL: formatDurationMinutes has 4 DIVERGENT implementations
A (public-provider)/[username]/_lib/public-provider-format.js:19
    "2 hr 30 min" / "1 hr" / "30 min" / "0 min" when zero
B (dashboard)/dashboard/_lib/provider-data.js:85
    "2 hours 30 minutes" / "1 hours" (no singular) / "" when zero
C (dashboard)/dashboard/add-ons/_components/treatment-add-ons-page.jsx:12  (inline, private)
    same output as B
D src/lib/bookings/booking-display.js:20
    "2 hours 30 minutes" with correct singular "1 hour"; fallback label for non-integer or <= 0
Merging A, B or D changes text rendered on screen => NOT behaviour preserving. Only C -> B is a
candidate for safe de-duplication, subject to proving equivalence.
formatPricePence similarly exists in A (Number(x ?? 0)/100) and booking-display.js (guarded) - do not merge.

## 8. Safe de-duplication confirmed
normalizeAddOnSearch is byte-identical in all three copies:
  book/[treatmentId]/page.jsx:13-18, book/[treatmentId]/time/page.jsx:12-17,
  book/[treatmentId]/checkout/page.jsx:30-35
buildTreatmentTimeHref already exists at (public-provider)/[username]/_lib/treatment-selection.js:28
Booking URL building also at book/actions.js:29-41 and :45-52.

## 9. Verification baseline
npm test       PASS  307/307, 0 fail, 0 skip, 0 todo
npm run typecheck PASS  zero errors
npm run lint   FAIL (exit 1)  10 problems, 2 errors + 8 warnings, ALL in handoff/support.js (untracked).
               Zero problems in tracked source. eslint.config.mjs has no ignore entry for handoff/.
npm run build  PASS  Next.js 16.3.3 Turbopack, 40/40 static pages collected, 46 dynamic routes.
               One cosmetic warning: MODULE_TYPELESS_PACKAGE_JSON on src/lib/legal/identity.js.
npm run test:db NOT RUN (lead will run at waves D, E and K)
Gate rule for later waves: no new lint problem OUTSIDE handoff/support.js;
test count at or above the count the previous wave left; build passes.
The current counts are in section 11.

## 10. Approved decisions (2026-09-21, from the product owner)

DECISION 1 — "Catalogue" is removed as a product concept.
  The three sections are Treatments, Treatment Groups, Add-ons. No umbrella heading exists.
  Each screen uses its own section name as its heading.
  - catalogue-section-nav.jsx:37 <h1>Catalogue</h1>  -> replaced by the active section's own name.
  - catalogue-section-nav.jsx:47 ariaLabel="Catalogue" -> replaced likewise.
  - File and identifier CatalogueSectionNav renamed with no new umbrella noun. Executed at task 6/G.
  - docs/product.md:49,70,114 and docs/architecture.md:5 use the word. Where it names these three
    sections as a product concept, task 15/K rewrites it to name the three sections explicitly.
    (docs/architecture.md:5 "file catalogue" is ordinary English, NOT the product concept - leave it.)
  APPROVED BEHAVIOUR CHANGE: the visible heading text changes. Not behaviour-preserving by design.

DECISION 2 — Treatments create/edit adopts focused-task chrome.
  RECORDED INCONSISTENCY (current, pre-change): /dashboard/treatments/new and
  /dashboard/treatments/[treatmentId]/edit are absent from focusedProviderRoutePatterns
  (app-header-client.jsx:13-17), so the full provider header renders; treatment-form.jsx:96-97
  renders a plain <h1> instead of FocusedTaskHeader. Treatment Group, Add-on and Location
  create/edit all hide the header and use FocusedTaskHeader.
  INTENDED: all three of Treatments, Treatment Groups and Add-ons use focused-task chrome.
  APPROVED BEHAVIOUR CHANGE, executed at task 7/H (with the H2 pattern added at task 4/D or 7/H).
  DO NOT generalise to any other route. Locations keeps its current behaviour unchanged.

DECISION 3 — components/ui stays deliberately conservative (task 2 scope reduction).
  Build only primitives with demonstrated reuse and already-clear semantics.
  Defer PageShell, PageHeader, EmptyState until real screens are migrated (task 5/F onward)
  unless a stable common API is already demonstrable. Do not freeze current inconsistencies
  into a new abstraction. Do not optimise for completing the originally proposed inventory.

## 11. Wave outcomes, remaining order, and the verification gate

### Completed
Wave A  task 0   baseline above. Read-only, no code changed.
Wave B  task 1   commit 97dd17f - the eight storefront formatters moved
                 verbatim to src/features/storefront/format.js; the three
                 byte-identical normalizeAddOnSearch copies moved to
                 src/features/storefront/add-on-search.js; buildTimeUrl
                 consolidated onto the identical buildTreatmentTimeHref.
                 Compatibility re-export left at the old _lib path for task 15.
        task 2   commit ac6383c - src/components/ui: Button
                 (primary/secondary/destructive), PendingButton, Input, Select,
                 Textarea, Checkbox, Field, and a composeClassName helper in a
                 plain .js module. Nothing migrated; no file under src/app
                 changed; the existing src/components/pending-button.jsx and
                 dashboard FormField are untouched.
                 Deferred for lack of a stable API, to be revisited only when
                 real screens are migrated: PageShell, PageHeader, EmptyState,
                 InputAffix, and a Button "text" variant.
                 Rejected during review: a test-side JSX loader built on private
                 next/dist/compiled/babel paths. node --test has no JSX
                 transform and this restructuring does not add one; the
                 primitives' only logic (className composition) is tested
                 directly instead, in the style the other tests use.
        chore    commit 7e45c25 - .claude/agents/ definitions committed;
                 .claude/worktrees/ ignored.

### Remaining wave order
Wave C   task 3                     alone
Wave D   task 4  chrome             alone          full gate incl. test:db
Wave E   task 12 checkout           alone          full gate incl. test:db
Wave F   task 5  ‖ task 9a
Wave G   task 6  ‖ task 13
Wave H   task 7  ‖ task 10
Wave I   task 8  ‖ task 11 ‖ task 9b
Wave J   task 14                    alone
Wave K   task 15                    alone          full gate incl. test:db

Task 9 is split: 9a covers the Treatments, Treatment Groups and Add-ons routes;
9b covers the booking and account loaders. The split keeps 9b from colliding
with task 13.
Task 12 runs alone by explicit instruction: it is the highest-consequence
customer- and payment-facing flow, and gets its own worker, its own diff
review, its own integration cycle and its own full verification gate.

### Verification gate as at commit 7e45c25
npm test        328 pass / 0 fail   (307 at Wave A, +16 task 1, +5 task 2)
npm run typecheck  zero errors
npm run lint    10 problems, ALL in handoff/support.js, zero in tracked source
npm run build   passes, 46 routes, all dynamic
A wave passes only if: no new lint problem outside handoff/support.js; the test
count does not fall; typecheck stays clean; the build still passes.
npm run test:db is run by the lead at waves D, E and K.

### Wave C outcome (appended 2026-09-21)

Wave C  task 3   commit 140cfe8 - the three remaining cross-route-group
                 imports now have a non-route owner:
                 StorefrontPage, buildStorefrontViewModel -> src/features/storefront/
                 SettingsSectionNav -> src/features/navigation/
                 logoutUser -> src/features/auth/logout-action.js ("use server")
                 Their route-private dependencies moved with them so nothing
                 under src/features imports from src/app: TreatmentSelectionList
                 (now treatment-selection-list.jsx) and the treatment-selection
                 helpers -> src/features/storefront/; SectionTabs ->
                 src/features/navigation/.
                 Bodies byte-identical except two relative import specifiers the
                 relocation required. Compatibility re-exports remain at all old
                 paths for task 15; unaffected callers (including book/actions.js)
                 still resolve through them. The signOut alias is kept.
                 No `@/app/` import remains anywhere in src/ or tests/.
                 Section 5's task 3 targets are RESOLVED.

Route-count correction. Section 9 and the gate above say "46 routes". The
route files at 140cfe8 are identical to e7cc76a, and the build table lists 48
lines: 47 routes plus /_not-found. The earlier figure was a counting
convention, not a different route set. From Wave D the gate compares the exact
route list printed by `npm run build`, not a count.

Terminology clarification. The rule behind Decision 1 is that "Catalogue" /
"Catalog" must not be introduced or retained as an umbrella product concept
for Treatments, Treatment Groups and Add-ons, and no replacement umbrella
product term is invented. Ordinary English and domain words are not banned.
The .claude/agents/ definitions were narrowed to match.

### Verification gate as at commit 140cfe8
npm test        328 pass / 0 fail
npm run typecheck  zero errors
npm run lint    10 problems, ALL in handoff/support.js, zero in tracked source
npm run build   passes; 47 routes + /_not-found, all dynamic; only known
                warning MODULE_TYPELESS_PACKAGE_JSON on src/lib/legal/identity.js

## 12. Product architecture correction (2026-09-21, from the product owner)

DECISION 4 - provider-management areas are independent product sections.
  At minimum: Treatments, Treatment Groups, Add-ons, Locations, Availability,
  Profile, Portfolio, Payments, Booking Settings. Preview is treated the same way.
  Each section is independently changeable and owns its own presentation,
  components, queries, actions and product behaviour.
  The earlier plan assumed three groupings. All three are withdrawn:
  - Treatments / Treatment Groups / Add-ons as one shared list-screen workspace
    (old task 6);
  - Profile / Portfolio / Availability / Locations / Preview as one
    page-settings feature (old task 10);
  - Payments / Booking Settings (with Account) as one Settings feature
    (old task 5).
  A current route prefix, a shared tab row, or a shared provider-navigation
  item is navigation, not product ownership. No replacement umbrella concept or
  feature directory is introduced for any of these groupings.
  Sections may share only genuinely product-agnostic infrastructure:
  src/components/ui primitives, generic page/layout primitives, generic
  tabs/navigation primitives (SectionTabs), generic status/display primitives
  (StatusBadge, FormField, FocusedTaskHeader), and dashboard-level chrome
  (header, provider navigation, focused-task header suppression). Using a
  shared primitive does not make two sections one feature.
  Existing domain-specific actions, queries and components stay independently
  owned unless the code is genuinely product-agnostic.

Effect on completed work: none needs undoing.
  - src/features/storefront/ is the public storefront (one product surface).
  - src/features/navigation/ owns generic navigation (SectionTabs) and the
    SettingsSectionNav tab row as navigation. It is not a Settings feature.
  - src/features/auth/logout-action.js is auth infrastructure.
Effect on task 4: none. Task 4 moves global and dashboard-level chrome only.
  Its focused-task route list is dashboard chrome, not a product grouping.

Evidence at 0c8ffe3 (import scan of src/app/(dashboard)/dashboard): no section
folder imports another section folder's modules, with one exception:
dashboard/page.jsx:3 (Today) imports getAllBookings from ./bookings/actions.
Shared dashboard modules are _components/{section-tabs (re-export),
form-field, focused-task-header, status-badge, settings-row,
page-section-nav, catalogue-section-nav, settings-section-nav (re-export)} and
_lib/{form-values, username, provider-data}. provider-data.js mixes
product-agnostic helpers (getSignedInProvider, price and duration
conversion) with section-specific ones (providerPageToFormValues: Profile;
treatmentToProviderTreatment: Treatments; weekday helpers: Availability).

### Disposition of the remaining original tasks

old 5  settings shell ........................ WITHDRAWN as a shell. Payments
       and Booking Settings become independent section tasks (S9, S10).
old 6  shared list shell ..................... WITHDRAWN. The Decision 1 part
       (remove the "Catalogue" heading and aria-label) becomes N1.
old 7  Treatments (Decision 2) ............... KEPT inside S1 (Treatments).
old 8  Treatment Groups + Add-ons ............ SPLIT into S2 and S3.
old 9a query/action split, three sections .... SPLIT into S1, S2, S3.
       There is no shared module across them.
old 9b booking/account loader split .......... KEPT as S11 (provider Bookings
       and Today) and S12 (customer bookings).
old 10 page-settings shell ................... WITHDRAWN. Becomes S4-S8.
old 11 availability/portfolio splits ......... KEPT inside S5 and S7.
old 12 checkout decomposition ................ KEPT, unchanged (Wave E).
old 13 shared booking detail ................. SUSPENDED pending a product
       decision: customer and provider booking detail are treated as
       independent; only product-agnostic display may be shared.
old 14 narrow client boundaries .............. KEPT as a final generic pass (X1).
old 15 remove re-exports, boundary rule, docs  KEPT (X2). Adds a section
       independence import rule.

The revised task list and wave order follow in section 13. Task numbers 0-4
and 12 keep their meaning.

## 13. Revised remaining plan after task 4 (proposed 2026-09-21, not yet approved)

Each section task has its own file fence: its own route folder, plus moving
its own section-specific helpers out of shared modules. A section task never
edits another section's folder. Generic infrastructure is changed only by
P1, N1, X1 and X2.

P1   provider-data split. Move section-specific helpers out of
     dashboard/_lib/provider-data.js to the section that owns them, with
     compatibility re-exports. Product-agnostic helpers stay. The surveyor
     confirms callers first. Behaviour-preserving move.
N1   Decision 1. Remove the "Catalogue" <h1> and aria-label. Each of the
     Treatments, Treatment Groups and Add-ons list screens shows its own
     section name as its heading. Retire CatalogueSectionNav without any
     replacement umbrella name. Where the cross-link tab list lives is an
     open decision (see below).
S1   Treatments. Decision 2 (focused-task chrome: add the two Treatments
     patterns to task 4's dashboard focused-task list and use
     FocusedTaskHeader), query/action split, and adopting ui primitives.
     Old 7 and the Treatments part of 9a.
S2   Treatment Groups. Query/action split and adopting ui primitives.
S3   Add-ons. The same, plus the baseline section 7 C->B formatter
     de-duplication, only if identical output is proven.
S4   Locations.
S5   Availability, including the oversized-component split (part of old 11).
S6   Profile, including the double <main> on /dashboard/profile (a landmark
     change that needs approval).
S7   Portfolio, including the oversized-component split (part of old 11).
S8   Preview. Probably nothing beyond primitives; may close as a no-op.
S9   Payments. Presentation only; no Stripe or payment semantics change.
S10  Booking Settings.
S11  Provider Bookings and Today. Split queries from actions. Today stops
     importing the Bookings actions module (dashboard/page.jsx:3).
S12  Customer bookings (account). Split queries from actions (old 9b).
X1   Narrow client boundaries. A generic pass over whatever is left.
X2   Remove compatibility re-exports. Add import-boundary rules: no @/app/
     imports; src/features never imports src/app; no section folder imports
     another section folder. Update docs/architecture.md, and docs/product.md
     where "Catalogue" names the three sections.

Proposed wave order after D (task 4) and E (task 12):
Wave F   P1                          alone (shared module with many callers)
Wave G   N1                          alone (touches three sections' list screens)
Wave H   S1 ‖ S4 ‖ S9                test:db (S9 is next to payments)
Wave I   S2 ‖ S5 ‖ S10
Wave J   S3 ‖ S6 + S8 ‖ S7
Wave K   S11 ‖ S12                   test:db (bookings)
Wave L   X1                          alone
Wave M   X2                          alone, full gate incl. test:db

Open decisions for the product owner:
  1. Old 13 (shared booking detail). Recommended: withdraw it. Customer and
     provider booking detail stay independent; share only product-agnostic
     display (src/lib/bookings/booking-display.js, StatusBadge).
  2. N1 cross-link tabs. Recommended: each of the three list screens renders
     the generic SectionTabs with its own inline three-link list and a static
     active item. No shared owner and no group name are needed, and one
     client component goes away. The alternative is a navigation-owned tab
     list in src/features/navigation.
  3. S6: approve fixing the double <main> landmark as an intended change.
  4. S11: Today owns its own query (recommended) rather than importing one
     owned by Bookings. Settle when the S11 brief is written.

## 14. Product owner decisions on section 13 (2026-09-21)

1. Old 13 (shared booking detail) is WITHDRAWN. Customer bookings and Provider
   Bookings stay independently owned. They may reuse generic display
   primitives, but there is no shared booking-detail feature owner.
2. N1 removes the "Catalogue" product concept and terminology ONLY. Existing
   navigation behaviour between Treatments, Treatment Groups and Add-ons is
   kept as it is until the product owner designs provider-dashboard
   navigation. No three-way tab redesign, no replacement grouping, and no new
   relationship between these sections.
3. S6: fix the double <main> on /dashboard/profile. This corrects document
   semantics; the visible experience is unchanged.
4. S11: Today owns its own query. Genuinely generic lower-level data access
   may live outside both sections; neither section owns the other's query.

After task 4 is accepted, the lead executes the rest of the programme toward
the section 12 end state without per-task approval. The lead may re-order or
re-decompose tasks when the repository evidence requires it. The lead stops
only for: a visible product behaviour decision; a product or navigation design
decision; possible booking, payment, refund, privacy, security or database
semantic change; a need to violate section independence; or a regression that
cannot be resolved without one of those. Section 13 is therefore a starting
decomposition, not a fixed plan.

## 15. Task 4 pre-dispatch capture (2026-09-21, HEAD 55fdea3, next dev)

Setup: local Supabase with local-only fixtures. Users customer@ceaute.test and
provider@ceaute.test; published @capturepro with one Treatment, Treatment
Group, Add-on and Location; draft @draftpro. Readings taken from the rendered
DOM after hydration. Loading boundaries: 5 (the "6" in section 2 was a
miscount; the set is identical at e7cc76a and HEAD).

Observed (H = app header, F = site footer; variant s/c/p = signed-out,
customer, provider):
  signed out  / /discover /privacy          H s, logo "/", F
              /sign-in /sign-up /verify /auth/error        no H, no F
              /@capturepro                   H s, F
              /@capturepro/book/<t>          H s, no F
              /dashboard/*, /account         redirect to /sign-in (proxy)
  customer    /discover (Discover active), /account/bookings (Bookings active)
                                             H c, logo /discover, F
              /account -> /account/settings  H c, no active link, F
              /dashboard -> /dashboard/onboarding          H c, no F
  provider    /dashboard (Today active), /dashboard/bookings (Bookings)
                                             H p, logo /discover, no F
              /dashboard/treatments, /treatments/new, /treatments/<id>/edit,
              /dashboard/treatment-groups, /dashboard/add-ons
                                             H p, "Treatments" active, no F
              /dashboard/treatment-groups/new|<id>/edit,
              /dashboard/add-ons/new|<id>/edit,
              /dashboard/locations/new|<id>/edit           no H, no F
              /dashboard/locations, /availability, /profile, /profile/portfolio,
              /profile/preview               H p, "Page" active, no F
              /dashboard/profile             two <main> elements (known)
              /dashboard/settings, /settings/booking, /settings/payments
                                             H p, "Settings" active, no F
              /account/settings              H p, "Settings" active, F
              /account/bookings, /discover, /@capturepro   H c, F
              /@capturepro/book/<t>          H c, no F
              /sign-in                       redirect to /dashboard
404 and error cases:
  /foo (s, c)                                root 404 UI, H, F
  /verifyx (s, p)                            root 404 UI, no H, no F
  /@draftpro, /@nosuchprovider (s)           404 UI, H, F
  /@capturepro/book/<zero-uuid> (s, c)       404 UI, H, no F
  /@capturepro/book/<t>/nope (s)             404 UI, H, no F
  /account/bookings/<zero-uuid> (c)          404 UI, H c, F
  /account/bookings/not-a-uuid (c)           error UI, H c, F
  /dashboard/bookings/<zero-uuid> (p)        404 UI, H p, no F
  /dashboard/bookings/not-a-uuid (p)         error UI, H p, no F
  /dashboard/nope (p)                        root 404 UI, H p, no F
  /dashboard/nope (c)                        redirect to /dashboard/onboarding

Probe: a temporary not-found.jsx in dashboard/ and [username]/ (deleted
afterwards). notFound() calls resolved to the nearest segment not-found
(dashboard bad booking; book bad Treatment; @draftpro). Unmatched URLs
(/dashboard/nope, /@capturepro/book/<t>/nope) still rendered the root
not-found under the root layout only.

Cross-area client navigation (customer, dev server), in ms:
/@capturepro 370, /account/bookings 391, /discover 366, /account/bookings 367,
/@capturepro 368, /discover 362.
