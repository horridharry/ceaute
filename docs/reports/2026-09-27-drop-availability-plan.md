# Drop availability: build plan

Dated 27 September 2026. A snapshot, not current behaviour. Written by the `ceaute-change` plan run for [decision 007](../decisions/007-availability-released-in-drops.md), reviewed by two critics (invariants, and product and scope), revised once, then tightened by the lead session. **Status: approved by the owner on 27 September 2026.** Not yet built.

Target: on Preview by 8 October for Provider B's 15 October drop. 8 October is go or no-go; on a no-go, B's trial moves to the 15 November drop. On a go, a full drop is rehearsed on Preview by 12 October.

## Summary

Replace the weekly-hours and blocked-dates model with dates grouped into drops, as decision 007 sets out. PostgreSQL stays the authority, so the first task is one new hand-written migration. It adds two tables: `availability_drop` (one drop time per drop) and `availability_date` (one row per date, with either hours or a list of start times). It adds three security-definer functions:
- `save_availability_drop`, the only way to write, for the owner only;
- `get_public_open_dates`, which returns only the dates of drops that have opened, on published pages;
- `get_public_availability_summary`, which returns the open drops plus only the next upcoming one, on a published page or to its owner. It returns only what each drop's name shows: the month (first of the month) for a drop named by its month, or its first and last dates only when the name itself is that range. So an unopened drop named 'November' leaks no exact dates (review fix).

The migration also:
- redefines `create_validated_booking_hold`: a start is accepted only on a date in an opened drop, inside its hours or at one of its start times; the 60-day line goes, and the other checks and the snapshot stay exactly as they are;
- redefines `provider_page_publication_check_values`, so the Availability requirement means at least one date from today on;
- drops the old tables and functions, which deletes weekly hours and blocked dates.

The JavaScript then follows, one slice at a time:
- the booking calculator and the 'When suits you?' screen: open dates only, no 'Closed' cards, next-drop lines, and a reload at the drop time;
- the storefront Availability section, read through the summary function so the owner's preview and the live page match;
- a rebuilt `/dashboard/availability`: a month grid, times for the picked dates together, Now or Later, one Save, and the unsaved-changes guard;
- the label of the publication requirement;
- the approved Terms and Privacy copy;
- the docs, now including the storefront read paragraph and the PostgreSQL responsibility list in docs/architecture.md (review fix).

Code facts that shape the plan:
- The exception texts 'Requested time is outside the booking rules.' and 'Requested time is unavailable.' are kept on purpose, so the regex at `book/actions.js:217` still sends a refused time back with the 'taken' notice.
- The `has_working_hours` column keeps its name, so the return types of the two publication functions and their JavaScript readers do not change.

The rows are only visible to someone who can already see the page. The whole change is one reversible model swap already accepted in decision 007, so no new decision record is needed.

New migration: yes. One-way door: no (decision 007 already records the model change).

## What changes

- Provider Availability screen: weekly weekday rows, the Save hours bar and the blocked-dates list are gone. The provider picks dates by tapping them (usually in one month), gives the chosen dates their times together, can change single dates, and chooses the drop time. Each date has either hours (one opening and one closing time, e.g. 10 am to 5 pm) or start times (a list, e.g. 10 am, 12 pm and 3 pm), never both and never two ranges. The provider never types individual 15-minute starts.
- Hours, start times and drop times sit on the quarter hour; a closing time must be after the opening time on the same date. Times on the provider screen are written as today ('10 am to 5 pm').
- Every date belongs to exactly one drop. A provider can have several drops. A drop has no name field: Ceaute names it by the month ('October') when all its dates are in one calendar month and no other current drop has dates in that month; otherwise by first and last dates with an en dash ('28 October – 10 November', '1–14 November').
- Drop time is chosen as 'Now' or 'Later' (a date and a quarter-hour time in UK time, now or later). Each drop reads 'Open for booking' or 'Opens 15 October at 7 pm'. If a Later time has already passed when the provider saves, the save is refused with a plain message asking for a later time (plainest wording; owner checks in the keyboard pass).
- One 'Save' covers a drop's dates, times and drop time. Leaving with unsaved changes asks first, as today (same iPhone reload/close-tab limitation). Customers see nothing of an edit until it is saved.
- After a drop opens the provider can still add or remove dates, change times, move the drop time earlier or later; moving it later hides the dates again. None of these asks for confirmation. Bookings already made never change, and a checkout already in progress may still complete.
- The screen keeps showing each date's confirmed bookings and payments in progress, read once on load and advisory only, as today.
- Past dates are not shown or editable; a drop whose dates have all passed disappears; a drop with no dates stops existing.
- With no dates, the screen says 'No dates yet.' with an 'Add dates' action.
- When a published page has no open and no upcoming dates, Availability says 'Customers can't book: you have no open dates.' The page's state does not change (still published and, if otherwise eligible, taking bookings), Home (Today) shows nothing new, and the old confirmation and banner for an all-closed week are removed.
- Publication requirement: working hours is replaced by 'at least one date from today on with times', even if its drop has not opened. The setup guide and Publication checklist call it 'Add your availability' with the detail 'At least one date from today on with times', linking to Availability. The requirement count stays eight.
- Storefront Availability section (still last, still headed 'Availability'): weekly opening hours are no longer shown. It says what is open for booking and when the next drop opens, e.g. 'October is open for booking' and 'November opens on 15 October at 7 pm', naming each open drop when there are several and showing only the next upcoming drop time. It never shows the dates of a drop before its drop time. Customers never read 'drop' or 'drop time'.
- Storefront: with nothing open and nothing coming, the Availability section is left out; on a paused page it is also left out. An open drop still reads 'open for booking' even if its remaining dates are full or inside 24 hours' notice (the booking screen says Full). The storefront changes at the drop time on the next page load; it does not update itself.
- Owner's unpublished preview shows the Availability section exactly as the live page would at that moment (upcoming drops as 'opens on…', no unopened dates).
- Book buttons stay on a published, taking-bookings page even when nothing is open; the booking screen then explains.
- 'When suits you?': the day strip shows only dates the provider has opened (no 'Closed' cards any more), with the month heading following the dates in view. A date with no free start says 'Full'; the first date with a free start is selected. There is no 60-day limit: every open date appears however far ahead.
- An open date where the chosen treatment with its add-ons fits at no start keeps 'No times' and 'There isn't a long enough gap for this booking on …'. A full date keeps '… is fully booked.' The 'Next available: Tue 6 Oct' button stays.
- The old 'There are no more times in the next 60 days.' line is replaced: when no later free date exists it reads 'There are no more times.' (plainest wording; owner checks).
- When no free start remains (nothing open, or everything open is full), the screen also says when the next drop opens, above any 'Full' dates: 'December opens on 15 November at 7 pm'. With nothing open: 'No dates are open. November opens on 15 October at 7 pm.' With nothing open and nothing coming: 'No dates are open for booking right now.'
- While the screen shows a next-drop line, it reloads itself at that drop time so the newly opened dates appear without the customer reloading.
- Start times offered: for a date with hours, every 15-minute start where the treatment plus add-ons fits inside the hours; for a date with start times, only those starts, any treatment may begin if it ends the same day, and a booking that runs into a later start removes that start. 24 hours' notice still applies. Times stay 24-hour, grouped Morning, Afternoon and Evening.
- A hold is accepted only on a date in a drop whose drop time has passed, inside that date's hours or at one of its start times. If a date was removed or its drop hidden between viewing and 'Continue to payment', the hold is refused with today's wording for a time that can no longer be booked.
- Existing weekly hours and blocked dates are deleted when this ships, not converted. A provider who had them has nothing to book until they add a drop; existing bookings are untouched.
- Terms, 'Treatments, prices and availability': '...and control their own opening hours and blocked dates.' becomes '...and choose which dates and times to open for booking, and when.' and the appointment rule becomes 'Appointments must start at least 24 hours ahead, on a date the provider has opened for booking, at a start time the provider offers. All times are London time.'
- Privacy, 'If you publish a provider page': 'your working hours and blocked dates' becomes 'the dates and times you open for booking, and when they open'.
- Terms and Privacy 'updated' dates become the day the change reaches Preview. The provider agreement (version 2026-09-18) is unchanged and nobody re-accepts.

## What must still hold

- 24 hours' notice, the 15-minute start grid, Europe/London local dates, an appointment ending on the day it starts, the ten-minute hold and signing up before it (docs/decisions/007, Unchanged; docs/product.md, Booking and availability).
- PostgreSQL re-validates every hold, and the GiST exclusion constraint rejects overlapping active bookings; the JavaScript calculator must agree with the hold check and changing it alone must not change what is accepted (docs/decisions/001; docs/decisions/007, Consequences).
- Availability is derived, not stored as slot rows; Ceaute never says 'slot' to users (docs/domain.md, Availability; docs/decisions/007, Words).
- Dates of an unopened drop must be left out by PostgreSQL itself in the public availability functions; only the next drop time is public (docs/decisions/007, Consequences).
- Nothing runs at the drop time: the drop time is compared with the clock on every read and hold, and the storefront and booking pages stay rendered on every request (docs/decisions/007, Consequences).
- Starting Checkout and confirming a payment do not re-check availability; a checkout in progress on a changed or re-hidden date may still complete (docs/decisions/007, Consequences; docs/product.md, Booking and availability).
- Payments are confirmed only by verified webhooks, never from Stripe return URLs; the held page only reads state (AGENTS.md; docs/decisions/003; docs/product.md).
- Bookings already made never change when dates, times or drop times change; each booking keeps its snapshot of terms and location (docs/decisions/007; docs/decisions/002).
- Publishing is a deliberate PostgreSQL operation on Settings → Publication only; Ceaute never auto-publishes or unpublishes, and a readiness change never unpublishes a live page (docs/product.md, publishing; provider-experience.md, Publication readiness).
- Setup complete, ready to publish, published, taking bookings, paused and suspended stay separate states; a paused page shows 'isn't taking online bookings right now' and no Book buttons (docs/domain.md; docs/product.md).
- The booking journey is the only source of bookable times; the storefront section describes, never offers, times (docs/product.md, storefront Availability).
- Storefront order: hero, identity, Portfolio preview, Treatments preview, reviews, Availability last; no Policies section (customer-experience.md; docs/product.md).
- Leaving the Availability screen with unsaved changes asks first (docs/product.md, availability screen; provider-experience.md, Saving).
- Customer booking context survives sign-in and returns to Review and pay (customer-experience.md, Authentication; docs/product.md).
- The exact appointment address stays private before payment (provider-experience.md, Location privacy; docs/product.md).
- Treatments, treatment groups and add-ons are independent sections; never call them a catalogue (SKILL.md; docs/domain.md).
- Copy: sentence case, no em dashes, no 'slot', 'drop'/'drop time' for providers only, customers read 'open for booking' and 'opens' (copy.md; customer-experience.md, Availability).
- No drop kit, customer drop emails, provider reminders, in-app messaging, 'always open' option or several ranges on one date in this change (docs/decisions/007, Left for later; undecided.md, Drops: later).
- RLS is not weakened and the service-role key never reaches the browser (AGENTS.md).
- Migrations are hand-written and ordered; no production migration, promotion or production setting change without the owner's approval (AGENTS.md; docs/release.md).
- The provider agreement version 2026-09-18 is not bumped (owner decision, 27 September 2026).

## Tasks

Tasks run in order, one agent each, inside the listed files. Protected tasks (database, bookings) run on the session model at high effort. Sections headed "ADDED BY THE LEAD SESSION AFTER REVIEW" are the lead's five fixes.

### T1. Migration: drops, dates, save function, public projections, new hold check, new publication check, drop weekly model  (protected)

**Files:** `supabase/migrations/202609270001_availability_drops.sql`

**Tests:** supabase/tests/database/availability_drops.test.sql (added in T2); npm run test:db after npx supabase db reset

Load the supabase-postgres-best-practices skill first. Create ONE new file supabase/migrations/202609270001_availability_drops.sql and edit no existing migration. Open it with a header comment that cites docs/decisions/007-availability-released-in-drops.md and summarises the list below. In order:

1. HELPERS
- ceaute.is_quarter_hour_time(t time) returns boolean: language sql, immutable, set search_path = ceaute, public. True when t is null or (extract(second from t) = 0 and extract(minute from t)::int % 15 = 0).
- ceaute.start_times_are_valid(times time[]) returns boolean: immutable sql. True only when:
  - cardinality(times) between 1 and 96;
  - every element is non-null, satisfies is_quarter_hour_time and is <= time '23:45';
  - elements are strictly ascending, so there are no duplicates.
- Revoke both from public, anon and authenticated. They are only used in CHECK constraints and inside definer functions.

2. TABLE ceaute.availability_drop
- Columns: id uuid primary key default gen_random_uuid(); provider_page_id uuid not null references ceaute.provider_page(id) on delete cascade; opens_at timestamptz not null; created_at timestamptz not null default now(); updated_at timestamptz not null default now().
- unique (id, provider_page_id), which the composite FK below uses.
- index on (provider_page_id).
- trigger availability_drop_set_updated_at before update, executing ceaute.set_updated_at().

3. TABLE ceaute.availability_date
- Columns: id uuid primary key default gen_random_uuid(); provider_page_id uuid not null; drop_id uuid not null; local_date date not null; hours_start time null; hours_end time null; start_times time[] null; created_at and updated_at, as in 2.
- Keys and indexes: foreign key (drop_id, provider_page_id) references ceaute.availability_drop(id, provider_page_id) on delete cascade; unique (provider_page_id, local_date), so a date belongs to exactly one drop; index on (drop_id).
- CHECK constraints:
  - availability_date_hours_or_start_times: (hours_start is not null and hours_end is not null and start_times is null) or (hours_start is null and hours_end is null and start_times is not null);
  - availability_date_hours_order: hours_end > hours_start;
  - availability_date_hours_quarter_hour: is_quarter_hour_time(hours_start) and is_quarter_hour_time(hours_end) and (hours_end is null or hours_end <= time '23:45');
  - availability_date_start_times_valid: start_times is null or start_times_are_valid(start_times).
- updated_at trigger, as in 2.

4. RLS AND GRANTS on both tables
- Enable RLS. Revoke all from anon and authenticated. Grant select only to authenticated. Write no insert, update or delete policy, so writes go only through the function in 5.
- One select policy per table, named <table>_select_own_provider: exists a provider_page with that id and owner_profile_id = (select auth.uid()). This is the pattern of availability_rule_select_own_provider in 202609080002.
- Grant select to service_role, as 202609120002 does for the old tables.

5. FUNCTION ceaute.save_availability_drop
- Signature: (target_provider_page_id uuid, target_drop_id uuid, opens_on date, opens_time time, drop_dates jsonb) returns uuid. plpgsql, security definer, set search_path = ceaute, public.
- Behaviour, in order:
  a. Raise 'Provider page not found.' unless a provider_page row exists with that id and owner_profile_id = auth.uid().
  b. today := (now() at time zone 'Europe/London')::date.
  c. Raise 'Dates must be a list.' when jsonb_typeof(drop_dates) <> 'array'.
  d. Drop time: opens_on and opens_time both null means Now: new_opens_at := now(). Exactly one null: raise 'Drop time is incomplete.' Otherwise raise 'Drop time must be on the quarter hour.' unless is_quarter_hour_time(opens_time); then new_opens_at := (opens_on + opens_time) at time zone 'Europe/London', and raise 'Drop time has passed.' when new_opens_at <= now().
  e. Parse with jsonb_to_recordset(drop_dates) as x(local_date date, hours_start time, hours_end time, start_times time[]) into a temp set: raise 'Choose dates from today on.' if any local_date is null or < today; raise 'Each date can only be saved once.' on duplicate local_date.
  f. When target_drop_id is null: return null if the set is empty; otherwise insert an availability_drop (target_provider_page_id, new_opens_at) returning id. When it is not null: select the drop for update where id = target_drop_id and provider_page_id = target_provider_page_id; raise 'Drop not found.' when there is none; otherwise update its opens_at to new_opens_at.
  g. Raise 'Date is in another drop.' if any parsed local_date already exists in availability_date for this page with a different drop_id.
  h. Delete this drop's availability_date rows with local_date >= today that are not in the parsed set.
  i. Insert the parsed rows. On conflict (provider_page_id, local_date), do update set hours_start, hours_end and start_times from excluded.
  j. If the drop has no availability_date row with local_date >= today, delete the drop (cascade removes its past rows) and return null. Otherwise return its id.
- Check violations are left to raise as SQLSTATE 23514.
- Revoke all from public, anon, authenticated and service_role. Grant execute to authenticated.

6. FUNCTION ceaute.get_public_open_dates
- Signature: (target_provider_page_id uuid) returns table(local_date date, hours_start time, hours_end time, start_times time[]). language sql, stable, security definer, set search_path = ceaute, public.
- Returns the page's availability_date rows joined to availability_drop and provider_page, where provider_page.status = 'published', availability_drop.opens_at <= now(), and local_date >= (now() at time zone 'Europe/London')::date. Ordered by local_date.
- Comment: 'Public projection: only dates of opened drops on a published page.'

7. FUNCTION ceaute.get_public_availability_summary (REVISED after review: it must not reveal an unopened drop's dates beyond what its name shows)
- Signature: (target_provider_page_id uuid) returns table(drop_month date, first_date date, last_date date, opens_at timestamptz, is_open boolean). language sql, stable, security definer, set search_path = ceaute, public.
- Page visibility: the page must have status = 'published', or owner_profile_id = (select auth.uid()). The owner case serves the owner's unpublished preview; the service-role client has no uid, so public reads see published pages only.
- Build with CTEs, all internal to the function:
  - current_dates: that page's availability_date rows with local_date >= today (London).
  - current_drops: per drop with at least one current date: drop id, opens_at, min_date = min(local_date), max_date = max(local_date).
  - named: current_drops plus named_by_month boolean = (date_trunc('month', min_date) = date_trunc('month', max_date)) and not exists (a current_dates row of this page whose drop_id differs and whose date_trunc('month', local_date) = date_trunc('month', min_date)). Every current drop, opened or not, counts for this sharing test, because the provider screen names drops the same way.
  - chosen: every named drop with opens_at <= now(), plus at most ONE named drop with opens_at > now(): the earliest opens_at, ties broken by earliest min_date.
- Output columns for each chosen row, computed ONLY from that row's own name:
  - drop_month = date_trunc('month', min_date)::date when named_by_month, else null;
  - first_date = min_date when not named_by_month, else null;
  - last_date = max_date when not named_by_month, else null;
  - is_open = opens_at <= now();
  - opens_at = the drop's opens_at when not is_open, else null.
- So an upcoming drop named 'November' returns only drop_month 2026-11-01 and its opens_at; an upcoming drop named '1–14 November' returns exactly the two dates its name shows. min_date/max_date and named_by_month are never returned as columns, and no other upcoming drop, date or count is returned.
- Order: open drops by min_date, then the upcoming one.
- Comment: 'Public projection: open drops and the next drop time. Returns only what each drop name shows (decision 007: unopened dates stay hidden).'

8. GRANTS for 6 and 7: revoke all from public, anon and authenticated, then grant execute to anon, authenticated and service_role.

9. REDEFINE ceaute.create_validated_booking_hold
- create or replace with the same signature. Copy the whole body verbatim from supabase/migrations/202609230002_percentage_holds_and_checkout.sql lines 27-279, with only these changes:
  - In declare, replace the 'availability_rule ceaute.availability_rule%rowtype;' variable with 'open_date record;'.
  - In the booking-rules IF (lines 159-166), delete only the line 'or requested_local_start::date > current_local_date + 60'. Keep the message 'Requested time is outside the booking rules.'
  - Replace lines 168-187 (the availability_rule lookup and the blocked_date check) with: select availability_date.hours_start, availability_date.hours_end and availability_date.start_times into open_date, from availability_date join availability_drop on availability_drop.id = availability_date.drop_id, where availability_date.provider_page_id = target_provider_page_id and availability_date.local_date = requested_local_start::date and availability_drop.opens_at <= now(), for share of availability_date (lock only the date row, as today's hold locks only its availability_rule row. save_availability_drop locks the drop first, so also locking the drop here could deadlock and show the customer an error page instead of the 'taken' notice. Decision 007 lets a hold made just before a drop is hidden again stand, so the drop row needs no lock); raise exception 'Requested time is unavailable.' when not found; raise the same exception when open_date.start_times is null and (requested_local_start::time < open_date.hours_start or requested_local_end::time > open_date.hours_end); raise the same exception when open_date.start_times is not null and not (requested_local_start::time = any(open_date.start_times)).
- Keep both exception texts exactly as they are: 'Requested time is outside the booking rules.' and 'Requested time is unavailable.' The regex in src/app/(public-provider)/[username]/book/actions.js:217 depends on them.
- Re-issue the same revoke and grant as lines 281-285 of that migration.

10. REDEFINE ceaute.provider_page_publication_check_values
- create or replace with an identical signature and return table. Copy the body verbatim from 202609230001_percentage_terms_and_publication_checks.sql lines 170-255.
- Change only the fifth expression, the one returned as has_working_hours: exists (select 1 from ceaute.availability_date where availability_date.provider_page_id = provider_page.id and availability_date.local_date >= (now() at time zone 'Europe/London')::date).
- Add a comment that has_working_hours keeps its name but now means 'at least one date from today on with times, opened or not' (decision 007).
- Do not touch provider_page_meets_publication_requirements, provider_page_accepts_new_bookings or get_provider_page_publication_checks.

11. REMOVE THE WEEKLY MODEL, without cascade: drop function ceaute.replace_provider_availability_rules(uuid, jsonb); drop function ceaute.get_public_availability_rules(uuid); drop function ceaute.get_public_blocked_dates(uuid); drop table ceaute.blocked_date; drop table ceaute.availability_rule. This deletes existing weekly hours and blocked dates without converting them.

12. comment on column ceaute.provider_page.booking_window_days is 'Unused. There is no booking window since decision 007.'

Do NOT touch claim_booking_checkout, the booking_no_active_overlap constraint, get_public_occupied_periods, get_provider_booking_counts_by_local_date or current_provider_agreement_version.

### T2. Database tests: new drops test and the five tests decision 007 replaces  (protected)

**Files:** `supabase/tests/database/availability_drops.test.sql`, `supabase/tests/database/mvp_booking_rules.test.sql`, `supabase/tests/database/alpha_consistency_hardening.test.sql`, `supabase/tests/database/public_projection_publication.test.sql`, `supabase/tests/database/provider_booking_counts.test.sql`, `supabase/tests/database/publication_checks_and_agreement.test.sql`

**Tests:** npm run test:db (fresh npx supabase db reset first)

Load supabase-postgres-best-practices first. Use the existing pgTAP style: begin, plan(N), a tap_results temp table, fixed UUIDs with a new unused prefix, and rollback.

HOW TO WRITE A FIXTURE
- Insert one availability_drop with opens_at = now() - interval '1 day'.
- Insert availability_date rows for every London date from today to today + 120, with hours_start '09:00' and hours_end '17:00'.
- 'London today' means (now() at time zone 'Europe/London')::date.

CREATE supabase/tests/database/availability_drops.test.sql. It asserts:

(a) Constraints and RLS
- CHECK rejects (23514): a date with both hours and start times, and one with neither; closing time not after opening time; an off-quarter-hour opening time; start_times with a duplicate, unsorted times, or an off-quarter-hour time.
- A second row for the same (provider_page_id, local_date) is rejected (23505).
- RLS: the owner, as authenticated, reads their own drops and dates; another provider and anon read 0 rows; authenticated cannot insert, update or delete either table directly.

(b) save_availability_drop
- A non-owner gets 'Provider page not found.'
- Now: opens_at <= now().
- Later: a future quarter hour is stored as the London local time converted; a past Later time raises 'Drop time has passed.'; an off-quarter Later time raises 'Drop time must be on the quarter hour.'; only one of the two drop-time fields raises 'Drop time is incomplete.'
- A past date raises 'Choose dates from today on.'
- A date already in another drop raises 'Date is in another drop.'
- Re-saving: dates absent from the payload are removed; times of kept dates are updated; saving with an empty list deletes the drop and returns null.

(c) get_public_open_dates
- Returns the dates of an opened drop on a published page.
- Returns 0 rows for: a drop whose opens_at is in the future; a draft page and a suspended page, including through the service role; dates before London today.

(d) get_public_availability_summary (REVISED: no unopened dates leak)
- Fixture on one published page, using dates relative to the first day of a month at least two months ahead (call it M, computed as date_trunc('month', London today + 62)::date so every date is in the future):
  - drop A: opened, dates M+2 and M+3 (month of M, but shares the month with drop C below);
  - drop C: upcoming, opens_at now() + 1 day, dates M+15 and M+20 (same month as A, so named by range);
  - drop D: upcoming, opens_at now() + 2 days, dates in the following month only, e.g. (M + interval '1 month')::date + 4 and + 10 (named by its month);
  - drop E: opened, dates only in the month after that (named by its month).
- As anon on the published page, assert:
  - exactly 3 rows: A and E (is_open true, opens_at null) and C (is_open false, its opens_at); D is absent;
  - A returns drop_month null, first_date M+2, last_date M+3;
  - E returns drop_month = its month's first day, first_date null, last_date null;
  - C (upcoming, range-named) returns first_date M+15 and last_date M+20 and drop_month null, and nothing else;
  - no row carries D's dates or D's opens_at in any column.
- Then delete drop C (directly, as the test superuser) so D is the next upcoming drop, and assert as anon: the upcoming row is D with drop_month = first of D's month, first_date null and last_date null, and no column of any returned row equals any of D's exact dates. This is the assertion that an upcoming drop named by its month returns no exact dates.
- Tie-break: two upcoming drops with the same opens_at return only the one with the earlier first date.
- A draft page: 0 rows when called as the service role or anon, and rows when called as its owner.

(e) create_validated_booking_hold, as the service role
- Accepted: a start inside the hours of an opened date; a start 90 days ahead, since there is no window; on a start-times date (for example 10:00, 12:00 and 15:00), a 10:00 start of a 150-minute treatment.
- Refused with 'Requested time is unavailable': the same start on a date whose drop has not opened; a date not in any drop; a start outside the hours; on the start-times date, 10:15, which is not a start time.
- Refused by the exclusion constraint: a second hold at 12:00 on that start-times date overlapping the first.
- Refused with 'Requested time is unavailable' after the drop time is moved later, using save_availability_drop as the owner.

(f) Publication checks
- has_working_hours from provider_page_publication_check_values is true with one future date whose drop has not opened.
- It is false when the page has only past dates, inserted directly, and false with no dates.

REWRITE THE FIVE TESTS NAMED IN DECISION 007. In each, replace the availability_rule and blocked_date fixture with the drop fixture above, and fix plan(N) to match.
- mvp_booking_rules.test.sql: remove the last_window_start and outside_window_start assertions (lines 73-74, 119) and every replace_provider_availability_rules or availability_rule_quarter_hour_boundaries assertion (lines 180-214); keep the booking_window_days not-writable assertion and the grid and notice assertions; add one assertion that a start 61 days ahead is now accepted.
- alpha_consistency_hardening.test.sql: drop the blocked_date fixture (lines 91, 98-101) and the 'booking window' and 'Blocked dates' assertions (lines 158-163, 171-176); keep 'Availability hours are enforced' (18:00, outside 09:00-17:00) and every other assertion unchanged; add 'A date in an unopened drop is refused'.
- public_projection_publication.test.sql: replace the get_public_availability_rules and get_public_blocked_dates count assertions (lines 116-138, 191-200, 228) with get_public_open_dates and get_public_availability_summary counts, for the same published, draft and suspended pages and callers.
- provider_booking_counts.test.sql: replace the blocked-date lock-in (lines 215-295). Now: a hold is made; the owner removes that date with save_availability_drop; the payment still completes through the existing completion path used in the file; a new hold on that date raises 'Requested time is unavailable'; the counts still show the confirmed booking.
- publication_checks_and_agreement.test.sql: keep line 101's column list unchanged (has_working_hours is still returned), and add one case where has_working_hours is false with no current dates.

ADDED BY THE LEAD SESSION AFTER REVIEW
- (b) also: anon cannot execute save_availability_drop (permission denied, 42501).
- (d) also: another signed-in provider gets 0 rows from get_public_availability_summary for a draft page they do not own.

### T3. Replace weekly-hours fixtures in the other database tests and race scripts  (protected)

**Files:** `supabase/tests/database/booking_email_cancelled_state.test.sql`, `supabase/tests/database/mvp_alpha_regressions.test.sql`, `supabase/tests/database/booking_inspiration_images.test.sql`, `supabase/tests/database/percentage_booking_terms.test.sql`, `supabase/tests/database/alpha_security_hardening.test.sql`, `supabase/tests/database/provider_locations.test.sql`, `supabase/tests/database/late_payment_refund_email.test.sql`, `scripts/db-races/booking-race-fixture.sql`, `scripts/db-races/provider-dashboard-fixture.sql`

**Tests:** npm run test:db; scripts/db-races/booking-races.sh and provider-dashboard-races.sh load their fixtures without error on a disposable database (if Docker is available; otherwise report unverified)

This is a mechanical fixture swap with no change to what each test asserts.

In each file, replace every 'insert into ceaute.availability_rule ... generate_series(0, 6) as weekday' fixture (or the single-weekday one in provider-dashboard-fixture.sql) with the drop fixture:
- one availability_drop per provider page, with a fresh fixed UUID in that file's prefix and opens_at = now() - interval '1 day';
- availability_date rows for that page and drop, for every date from London today to today + 120, with the same hours the old rule used ('09:00' to '17:00').

Where several pages were covered through a select from provider_page (percentage_booking_terms.test.sql:119-121, provider_locations.test.sql:40-46), do the same per page with a cross join.

Other replacements:
- mvp_alpha_regressions.test.sql: remove the blocked_date insert (line 62). Replace the two cross-provider RLS count assertions (lines 442-449) with the same assertions on ceaute.availability_drop and ceaute.availability_date ('Another provider sees no drops' / 'no dates').
- provider_locations.test.sql:486: replace the get_public_availability_rules count with a get_public_open_dates count, expecting that fixture's date count or 0 as the original assertion expected.

Adjust plan(N) only if an assertion count changed. Finally run grep -rn -E 'availability_rule|blocked_date|get_public_availability_rules|get_public_blocked_dates|replace_provider_availability_rules' supabase/tests scripts and confirm no hit remains outside supabase/migrations.

### T4. Shared drop naming and drop-time wording

**Files:** `src/lib/availability/drops.js`, `tests/availability-drops.test.js`

**Tests:** tests/availability-drops.test.js (new); npm test

Create the pure ES module src/lib/availability/drops.js, with no React and no Supabase. Dates are 'YYYY-MM-DD' strings and times are Europe/London.

Exports:
- monthName(localDate): the full English month name of that date, e.g. 'November'. No year.
- rangeName(firstDate, lastDate): same month gives '1–14 November' (en dash, no spaces); different months give '28 October – 10 November' (spaced en dash). No year.
- dropName({ firstDate, lastDate, sharesMonth }), used by the provider screen: when firstDate and lastDate are in the same year and month and not sharesMonth, monthName(firstDate); otherwise rangeName(firstDate, lastDate).
- formatDropTime(opensAt) takes an ISO string or Date and returns '15 October at 7 pm': the London day and month, then formatClockTime of the London HH:MM, importing formatClockTime from src/lib/time/clock-time.js.
- opensSentence(name, opensAt) returns `${name} opens on ${formatDropTime(opensAt)}`.
- openForBookingSentence(names): one name gives '<A> is open for booking'; two give '<A> and <B> are open for booking'; three or more give '<A>, <B> and <C> are open for booking'. An empty list gives ''.
- summaryFromRows(rows) maps get_public_availability_summary rows ({ drop_month, first_date, last_date, opens_at, is_open }) to { open: [name...], next: { name, opensAt } | null }. Each row's name is monthName(drop_month) when drop_month is set, otherwise rangeName(first_date, last_date). The first row with is_open false becomes next. It never reads a shares_month field (the function no longer returns one).

Never use 'slot' in any returned string, and use no em dash.

tests/availability-drops.test.js covers:
- monthName, both rangeName branches (including a range spanning December into January) and every dropName branch;
- formatDropTime across a GMT and a BST date, and at a :30 time ('7:30 pm');
- the openForBookingSentence joins;
- summaryFromRows with no rows, open only, upcoming only (a month-named row with first_date and last_date null, and a range-named row with drop_month null), and both.

### T5. Booking journey: calculator, day strip, next-drop lines, reload at drop time  (protected)

**Files:** `src/app/(public-provider)/[username]/_lib/public-provider-data.js`, `src/app/(public-provider)/[username]/book/_lib/appointment-availability.js`, `src/app/(public-provider)/[username]/book/_lib/time-choices.js`, `src/app/(public-provider)/[username]/book/_components/when-suits-you.jsx`, `src/app/(public-provider)/[username]/book/_components/reload-at-drop-time.jsx`, `src/app/(public-provider)/[username]/book/[treatmentId]/time/page.jsx`, `src/lib/bookings/appointment-grid.js`, `tests/appointment-availability.test.js`, `tests/time-choices.test.js`

**Tests:** tests/appointment-availability.test.js (rewritten); tests/time-choices.test.js (rewritten); npm test; npm run typecheck; npm run lint; npm run build

Read the Next.js guides in node_modules/next/dist/docs/ for useRouter().refresh() in client components before editing.

1. public-provider-data.js
- Delete getAvailabilityRulesForProvider and getBlockedDatesForProvider.
- Add getOpenDatesForProvider: a cached service-role rpc to get_public_open_dates, throwing 'Could not load availability.' on error.
- Add getAvailabilitySummaryForProvider: a cached service-role rpc to get_public_availability_summary that returns summaryFromRows(data) from @/lib/availability/drops. Log with logSupabaseError and throw 'Could not load availability.' on error.
- In getPublicBookingPage and getPublicBookingDetailsPage, replace the rules and blocked-dates reads with getOpenDatesForProvider. Pass openDates to calculateAvailableAppointmentTimes.
- Remove availabilityRules from getPublicBookingPage's return value (no caller reads it).
- getPublicBookingPage additionally returns nextDrop: getAvailabilitySummaryForProvider(...).next, fetched in the same Promise.all.

2. appointment-availability.js
- Delete BOOKING_WINDOW_DAYS, weekdayForLocalDate and addLocalDays (if unused), and remove BOOKING_WINDOW_DAYS from BOOKING_AVAILABILITY_CONSTANTS.
- New signature: calculateAvailableAppointmentTimes({ now = new Date(), openDates, appointments, durationMinutes, timeZone }).
- Iterate openDates, sorted by local_date and skipping dates before London today. For each date:
  - hours (start_times null): step from hours_start by APPOINTMENT_GRID_MINUTES while slotMinutes + durationMinutes <= hours_end minutes, as today;
  - start times: candidates are exactly start_times (HH:MM from 'HH:MM:SS').
  - In both cases a candidate counts only if slotMinutes + durationMinutes < 24 * 60, the same-day end the hold check enforces. Then apply the existing nonexistent-local-time, 24-hour notice and overlap logic unchanged.
- unavailable_reason is one of 'short' (no candidate fits), 'notice' or 'full'. There is no 'closed'.
- Update the header comment: it mirrors ceaute.create_validated_booking_hold (202609270001), with no window.

3. time-choices.js
- Remove every 'closed' branch: the buildDayStrip ', closed' label, unavailableDayMessage's "isn't working on" and dayStatusWord's 'Closed'.
- Keep buildDayStrip's leading-notice trim, 'Full', 'No times', "There isn't a long enough gap for this booking on …" and '… is fully booked.'
- Add nothingOpenMessage(nextDrop): 'No dates are open. ' + opensSentence(nextDrop.name, nextDrop.opensAt) + '.' when nextDrop is set, otherwise 'No dates are open for booking right now.'
- Add nextDropLine(nextDrop): opensSentence(...), with no full stop, or '' when nextDrop is null.

4. when-suits-you.jsx
- New props nextDrop and serverNow (ms).
- Remove the BOOKING_AVAILABILITY_CONSTANTS import and the dashed 'closed' card class branch.
- When days.length === 0: render the existing bordered box with the single line nothingOpenMessage(nextDrop), replacing both old lines.
- When days exist but firstAvailableIndex(days) === -1 and nextDrop is set: render a <p> with nextDropLine(nextDrop) above the month heading, then the strip as today.
- Replace 'There are no more times in the next {BOOKING_WINDOW_DAYS} days.' with 'There are no more times.'
- Whenever a nothingOpenMessage or nextDropLine with a nextDrop is rendered, also render <ReloadAtDropTime opensAt={nextDrop.opensAt} serverNow={serverNow} />.

5. reload-at-drop-time.jsx
- New 'use client' component that renders null.
- In useEffect: delay = Date.parse(opensAt) - serverNow + 2000.
- If 0 < delay <= 2_000_000_000, set a timeout that calls useRouter().refresh(), and clear it on unmount. Otherwise schedule nothing.

6. time/page.jsx
- Destructure nextDrop.
- Pass nextDrop and serverNow={Date.now()} to WhenSuitsYou.
- Give WhenSuitsYou key={days.map((d) => d.localDate + d.status).join('|')} so it remounts, and selects the first free date, after a refresh.
- Keep the takingBookings notice branch and the 'taken' notice unchanged.

7. appointment-grid.js: update its comment only (the grid is enforced on availability_date and in create_validated_booking_hold). No behaviour change.

Do NOT change book/actions.js, checkout/page.jsx, checkout-session.js or queries.js. They keep working because availableDates keeps its shape, and the hold's exception texts are unchanged.

Tests
- Rewrite tests/appointment-availability.test.js. Keep the localDateTimeToInstant and DST cases, and cover: an hours date offering every 15-minute fit; a start-times date offering only its listed starts that end the same day; a booking running into a later start removing that start; 24h notice producing 'notice'; a too-long treatment producing 'short'; a fully booked date producing 'full'; a date 120 days ahead being offered; dates not in openDates never appearing.
- Rewrite tests/time-choices.test.js: no 'closed' status anywhere; Full and No times words; both nothingOpenMessage outputs; nextDropLine; an assertion that when-suits-you.jsx no longer contains 'in the next' or 'Closed' and contains 'There are no more times.'

ADDED BY THE LEAD SESSION AFTER REVIEW
- when-suits-you.jsx: narrow today's early return (days.length === 0 || firstAvailableIndex(days) === -1) to days.length === 0 only. When no day has a free start, select the first day (index 0). When everything open is full and no drop is coming, show the strip with its Full labels and no extra line.
- reload-at-drop-time.jsx: when delay <= 0 (the drop time has passed but the page still showed the drop as upcoming, for example a small clock difference between the server and the database), set the timeout to 5000 ms instead of scheduling nothing, so the screen keeps checking until the dates appear. Add a unit-free source pin for this branch in tests/time-choices.test.js if practical.

### T6. Storefront Availability section from the public summary

**Files:** `src/features/storefront/storefront-view-model.js`, `src/features/storefront/availability-queries.js`, `src/features/storefront/opening-hours.js`, `src/features/storefront/availability-summary.js`, `src/features/storefront/storefront-page.jsx`, `tests/storefront-opening-hours.test.js`, `tests/storefront-availability.test.js`

**Tests:** tests/storefront-availability.test.js (new); tests/storefront-closure.test.js (unchanged, must pass); tests/storefront-privacy.test.js and tests/storefront-reviews.test.js (unchanged, must pass); npm test

1. Delete src/features/storefront/availability-queries.js and opening-hours.js.

2. Create src/features/storefront/availability-summary.js exporting availabilitySummaryQuery(supabase, providerPageId). It returns supabase.schema('ceaute').rpc('get_public_availability_summary', { target_provider_page_id: providerPageId }), which resolves to { data, error } like the other queries. Comment: PostgreSQL leaves out unopened dates, returns only what each drop name shows and only the next drop time; the owner's RLS client sees their own unpublished page through the same function.

3. storefront-view-model.js
- Replace openingHoursQuery with availabilitySummaryQuery in the Promise.all and in the failures map, under the key availability.
- Replace the returned opening_hours with availability: summaryFromRows(result.data), from @/lib/availability/drops.
- Change nothing else.

4. storefront-page.jsx
- Keep the component name 'function Availability'; tests/storefront-reviews.test.js slices on it.
- Keep its place last in the stack and its heading 'Availability'.
- It takes summary ({ open, next }) and renders: openForBookingSentence(open) as a <p> when open.length; opensSentence(next.name, next.opensAt) as a <p> when next. Plain text only: no links, no times, no buttons.
- In StorefrontPage, read viewModel.availability (default { open: [], next: null }). Render the section only when takingBookings && (open.length > 0 || next). A paused public page (takingBookings false) and 'nothing open, nothing coming' both leave it out; the owner preview keeps takingBookings' default of true.
- Update the comments above Availability to describe open drops and the next drop time.

5. Delete tests/storefront-opening-hours.test.js and add tests/storefront-availability.test.js. Source pins, in the style of storefront-privacy.test.js:
- the view model calls availabilitySummaryQuery(supabase, providerPage.id);
- no storefront source contains .from("availability_date") or .from("availability_drop");
- storefront-page.jsx still renders <Availability last, and the render condition includes takingBookings;
- the words 'drop', 'slot' and '—' never appear in the Availability component's JSX text.
- Also include unit cases: summaryFromRows([{ drop_month: '2026-10-01', first_date: null, last_date: null, opens_at: null, is_open: true }, { drop_month: '2026-11-01', first_date: null, last_date: null, opens_at: '2026-10-15T18:00:00Z', is_open: false }]) followed by the sentences produces 'October is open for booking' and 'November opens on 15 October at 7 pm'; a range-named upcoming row produces '1–14 November opens on …'.

### T7. Provider Availability screen: dates, times, drop time, one Save  (protected)

**Files:** `src/app/(dashboard)/dashboard/availability/page.jsx`, `src/app/(dashboard)/dashboard/availability/availability-form.jsx`, `src/app/(dashboard)/dashboard/availability/actions.js`, `src/app/(dashboard)/dashboard/availability/queries.js`, `src/app/(dashboard)/dashboard/availability/_lib/drop-form.js`, `src/app/(dashboard)/dashboard/availability/_lib/booking-messages.js`, `src/app/(dashboard)/dashboard/availability/_lib/schedule-form.js`, `src/app/(dashboard)/dashboard/availability/_lib/weekdays.js`, `src/app/(dashboard)/dashboard/availability/_lib/today-london.js`, `src/app/(dashboard)/dashboard/availability/_components/weekly-schedule-form.jsx`, `src/app/(dashboard)/dashboard/availability/_components/weekday-row.jsx`, `src/app/(dashboard)/dashboard/availability/_components/save-hours-bar.jsx`, `src/app/(dashboard)/dashboard/availability/_components/blocked-dates-form.jsx`, `src/app/(dashboard)/dashboard/availability/_components/block-date-panel.jsx`, `src/app/(dashboard)/dashboard/availability/_components/closed-week-dialog.jsx`, `src/app/(dashboard)/dashboard/availability/_components/drop-list.jsx`, `src/app/(dashboard)/dashboard/availability/_components/drop-editor.jsx`, `src/app/(dashboard)/dashboard/availability/_components/month-grid.jsx`, `tests/availability-schedule-form.test.js`, `tests/availability-weekdays.test.js`, `tests/availability-booking-messages.test.js`, `tests/availability-drop-form.test.js`, `tests/dashboard-screens.test.js`, `src/components/ui/confirm-dialog.jsx`

**Tests:** tests/availability-drop-form.test.js (new); tests/availability-booking-messages.test.js (updated); tests/dashboard-screens.test.js (updated); tests/unsaved-navigation.test.js (unchanged, must pass); tests/import-boundaries.test.js (unchanged, must pass); npm test; npm run typecheck; npm run lint; npm run build

Load the ceaute-product-design skill, then read the Next.js docs for Server Actions and useActionState. Reuse the existing UI primitives in src/components/ui (Button, PendingButton, Select, Input, Notice, EmptyState, FormFeedback) and useUnsavedChanges from src/components/unsaved-changes. Any detail not settled below keeps today's pattern, or failing that the plainest wording, for the owner's keyboard pass.

DELETE
- _components: weekly-schedule-form.jsx, weekday-row.jsx, save-hours-bar.jsx, blocked-dates-form.jsx, block-date-panel.jsx and closed-week-dialog.jsx. This removes the all-closed confirmation and banner.
- _lib: schedule-form.js and weekdays.js.
- tests/availability-schedule-form.test.js and tests/availability-weekdays.test.js.

_lib/booking-messages.js
- Keep toBookingCountsByDate.
- Rename formatBlockedDateBookingsLine to formatDateBookingsLine, with the same output.
- Delete formatBookingsOnDateMessage (its blocking wording is obsolete).
- Update the header comment. Update tests/availability-booking-messages.test.js to match.

_lib/drop-form.js (pure)
- TIME_OPTIONS: quarter-hour values '00:00'…'23:45', labelled with formatClockTime.
- formatDateLabel(localDate): the same form today's formatBlockedDate used, moved here. formatDateTimes(date): formatClockRange for hours, or a start-times list such as '10 am, 12 pm and 3 pm'.
- dropStatusLine(drop, now): 'Open for booking' when opensAt <= now, else 'Opens ' + formatDropTime(opensAt).
- namedDrops(drops): adds name via dropName from @/lib/availability/drops, with sharesMonth computed across all current drops (the same rule the SQL summary uses).
- parseDropForm(formData): fields drop_id, drop_time ('now'|'later'), opens_on, opens_time, and dates (a JSON array of { local_date, hours_start, hours_end, start_times }). Returns { value } or { error }. Validation messages:
  - any date without times: 'Add times for every date.';
  - closing not after opening, or a time off the quarter hour: 'Choose 15-minute opening and closing times, with closing after opening.' (today's wording);
  - Later without both fields: 'Choose a date and time for Later.';
  - Later not in the future: 'That time has passed. Choose a later drop time.'
- isDraftDirty(draft, baseline).

queries.js
- Replace getSchedule and getBlockedDates with getDrops(). Using the signed-in provider's RLS client, it selects from availability_drop: id and opens_at; from availability_date: drop_id, local_date, hours_start, hours_end and start_times, where local_date >= todayInLondon().
- It groups dates under drops, drops any drop with no current dates, sorts drops by first date and applies namedDrops.
- Keep getBookingCountsByDate unchanged.

actions.js
- Replace updateSchedule, blockDate and removeBlockedDate with saveDrop(_state, formData). It calls getSignedInProvider, then parseDropForm, then rpc('save_availability_drop', { target_provider_page_id, target_drop_id (null for new), opens_on and opens_time (null for Now), drop_dates }).
- Map errors: message includes 'Drop time has passed': 'That time has passed. Choose a later drop time.'; 'Date is in another drop': 'That date is already in another drop.'; 'Choose dates from today on': 'Choose dates from today on.'; code 23514: today's 15-minute message; anything else: 'Could not save availability.'
- On success, revalidatePath('/dashboard/availability') and revalidatePath('/', 'layout') as today, and return { status: 'saved' }.

page.jsx
- Load getDrops, getBookingCountsByDate and getSignedInProvider in parallel.
- Pass drops, bookingCountRows, isPublished, today, now (Date.now()) and saveDrop to AvailabilityForm.

availability-form.jsx
- DashboardPage title 'Availability', description 'Pick dates, give them times and choose when they open for booking.' (plainest; owner checks).
- When isPublished and drops is empty, show a neutral Notice: "Customers can't book: you have no open dates." Show no other state change or banner.
- When no editor is open and drops is empty, show EmptyState 'No dates yet.' with an 'Add dates' button that opens a new-drop editor.
- Otherwise: render <DropList> (each drop: name, dropStatusLine, and each date's formatDateLabel, formatDateTimes and a muted formatDateBookingsLine from toBookingCountsByDate, all advisory); each drop has an 'Edit' action; an 'Add dates' button opens a new-drop editor.
- Only one editor is open at a time.

_components/month-grid.jsx ('use client')
- A Monday-first month calendar with previous-month and next-month buttons. Previous is disabled at the current month. The heading is 'Month YYYY'.
- Each day is a button with aria-pressed. Dates before today are disabled. Dates in another drop are disabled, with an aria-label ending ', in <drop name>'.
- Tapping a day toggles it in the draft.

_components/drop-editor.jsx ('use client')
- The draft holds dates ({ local_date, hours_start, hours_end, start_times }) and a drop time: 'now' or 'later' with opens_on and opens_time. The baseline is the saved drop; a new drop starts with no dates and 'now'.
- Call useUnsavedChanges(isDraftDirty(draft, baseline)).
- Render, in order:
  1. MonthGrid, opened at the month of the drop's first date or today.
  2. A 'Times' panel for every draft date without times: a heading with the count of those dates; a choice of 'Hours' or 'Start times'. Hours has opening and closing Selects from TIME_OPTIONS, defaulting to 09:00 and 17:00 as today. Start times has a Select plus 'Add time' and a list of added times, each with 'Remove'. Then one button, 'Set times', applies them to all those dates together.
  3. The list of draft dates with times, each with 'Change times' (opens the same panel for that one date) and 'Remove'.
  4. Drop time: a radio group, 'Now' or 'Later'. Later shows a date Input (min = today) and a time Select from TIME_OPTIONS.
  5. Form actions: 'Save' (PendingButton, submitting hidden fields to saveDrop through useActionState) and 'Cancel' (discards the draft and closes the editor).
- Show errors with the existing FormFeedback pattern. On 'saved', close the editor and show today's saved confirmation.
- Show no confirmation dialog anywhere. Words: 'drop' and 'drop time' are allowed here; never 'slot'; no em dashes.

tests/dashboard-screens.test.js: replace 'availability only gains the shared page frame' (lines 148-153). It now asserts that availability-form.jsx has title="Availability", renders <DropList and 'No dates yet.', and no longer contains WeeklyScheduleForm, BlockedDatesForm or 'Close every day'.

tests/availability-drop-form.test.js (new) covers: parseDropForm (valid hours, valid start times, a missing-times error, the closing-before-opening error, Later incomplete, Later passed, and Now producing null opens fields); formatDateTimes for both kinds; dropStatusLine open and upcoming; namedDrops sharesMonth; isDraftDirty.

ADDED BY THE LEAD SESSION AFTER REVIEW
- Editing an open drop: the editor's baseline drop time for a drop that has already opened is 'now', so saving an edit (adding or removing a date, changing times) keeps it open; save_availability_drop then sets opens_at to now(), which is harmless for an open drop. Choosing 'Later' hides it again until the new time. For an upcoming drop the baseline is 'later' with its saved London date and time. Without this, every edit to an open drop would fail with 'That time has passed.' Cover it in tests/availability-drop-form.test.js (the baseline for an open drop and for an upcoming one).
- src/components/ui/confirm-dialog.jsx: its header comment names the deleted Availability closed-week dialog as its pattern; name another existing use (cancelling a booking) instead. Comment only.
- Wording the design notes do not settle, for the owner's keyboard pass (keep exactly these unless an existing string already covers it): the page description 'Pick dates, give them times and choose when they open for booking.', 'Edit', 'Hours', 'Start times', 'Add time', 'Remove', 'Set times', 'Change times', 'Cancel', 'Add times for every date.', 'Choose a date and time for Later.', 'That time has passed. Choose a later drop time.', 'That date is already in another drop.', 'Choose dates from today on.' and 'Could not save availability.' List them in the task report.

### T8. Publication requirement label

**Files:** `src/app/(dashboard)/dashboard/_lib/publication-checks.js`, `tests/mvp-experience.test.js`

**Tests:** tests/mvp-experience.test.js; tests/dashboard-your-page.test.js and tests/provider-bookings.test.js (unchanged, must pass); npm test

In SETUP_TASKS, change only the task with id 'hours':
- name becomes 'Add your availability';
- detail becomes 'At least one date from today on with times'.
Keep id 'hours', check 'has_working_hours', href '/dashboard/availability' and cta 'Open Availability'. Add a one-line comment that has_working_hours now means a date from today on (decision 007). The count stays 8.

In tests/mvp-experience.test.js, add an assertion that the hours task has exactly that name and detail. Leave the existing has_working_hours fixtures as they are.

### T9. Approved Terms and Privacy copy

**Files:** `src/app/(site)/terms/page.tsx`, `src/app/(site)/privacy/page.tsx`, `tests/legal-pages-copy.test.js`

**Tests:** tests/legal-pages-copy.test.js (new); npm run build (runs scripts/assert-legal-identity.mjs)

terms/page.tsx, section 'Treatments, prices and availability':
- Lines 91-94: replace 'and control their own opening hours and blocked dates.' with 'and choose which dates and times to open for booking, and when.' Keep the next sentence, 'Ceaute does not check or guarantee that any of it is accurate.'
- Lines 103-105: replace the paragraph with 'Appointments must start at least 24 hours ahead, on a date the provider has opened for booking, at a start time the provider offers. All times are London time.'

privacy/page.tsx line 87: replace 'your working hours and blocked dates' with 'the dates and times you open for booking, and when they open'.

In both files, set the updated="…" prop to the day this branch is merged into preview, in the 'D Month YYYY' form. If it is built earlier, use the build day and say in the report that it must be corrected to the merge-to-Preview day.

Do not touch docs/provider-agreement-draft.md, PROVIDER_AGREEMENT_VERSION or ceaute.current_provider_agreement_version().

Add tests/legal-pages-copy.test.js, which reads both source files and asserts:
- the three new sentences are present;
- 'blocked dates', '60 days' and 'working hours' are absent from both files. The Terms payout sentence about 'working days' at line 195 is unaffected, so match 'working hours' only.

### T10. Documentation updates

**Files:** `docs/product.md`, `docs/domain.md`, `docs/architecture.md`, `docs/release.md`, `docs/decisions/001-postgresql-protects-booking-integrity.md`, `.agents/skills/ceaute-product-design/references/provider-experience.md`, `.agents/skills/ceaute-product-design/SKILL.md`, `.agents/skills/ceaute-product-design/references/copy.md`, `docs/design-system.md`

**Tests:** grep of docs/architecture.md for the stale terms listed in the change returns only unrelated hits; Manual read-through against the code (no automated doc tests)

Describe current behaviour only. Do not edit customer-experience.md. In provider-experience.md change only the one sentence named below; the drop decisions recorded there are the owner's.

docs/product.md
- Publishing requirements (27-34): replace 'working hours' with 'at least one date from today on with times, even if its drop has not opened'.
- Storefront Availability paragraph (158-164): open drops and the next drop time; left out when nothing is open or coming, and on a paused page; changes on the next page load.
- 'When suits you?' (282-288): only opened dates; no Closed cards; no 60-day window; Full and No times; the next-drop lines and nothing-open messages; 'There are no more times.'; the reload at the drop time.
- Availability-derivation (308-311) and fixed rules (313-321): dates with hours or start times; drops; a hold only on an opened drop; no window.
- /dashboard/availability paragraph (323-337): drops, the month grid, Set times, Now or Later, one Save, no warnings, past dates hidden, 'No dates yet.', and the 'Customers can't book: you have no open dates.' notice replacing the all-closed confirmation and banner.
- Remove 'recurring availability exceptions' from the not-implemented list.

docs/domain.md (66-69): replace the Availability definition with date, hours, start times, drop and drop time. Say there is no booking window and no slots are stored.

docs/architecture.md (every stale availability mention; after editing, grep the file for 'availability_rule', 'blocked', 'working hours', 'opening hours', 'opening-hours', 'availability-queries', 'window' and '60' and leave only unrelated hits such as the browser `window` at line 303):
- Row 42 ('Working hours and blocked dates'): rename it 'Availability (dates and drops)', listing availability/queries.js, availability/actions.js, availability/_lib/drop-form.js, availability/_lib/booking-messages.js, availability/_components/drop-editor.jsx and month-grid.jsx, src/lib/availability/drops.js and src/lib/bookings/appointment-grid.js; PostgreSQL column: save_availability_drop, quarter-hour and hours-or-start-times checks, availability_drop/availability_date RLS, get_provider_booking_counts_by_local_date (advisory counts).
- Row 49 'Choose add-ons and time': get_public_open_dates and get_public_availability_summary replace get_public_availability_rules and get_public_blocked_dates; get_public_occupied_periods stays.
- Public page row: add get_public_availability_summary.
- Storefront read paragraph (lines 169-177, 'Opening hours read `availability_rule` through ...'): replace it with: the storefront Availability section reads get_public_availability_summary through src/features/storefront/availability-summary.js; PostgreSQL returns only open drops and the single next upcoming drop, only on a published page or to its owner, and returns only what each drop name shows (the month, or the first and last dates when the name is that range), so unopened dates never leave the database; src/lib/availability/drops.js turns the rows into 'October is open for booking' and 'November opens on 15 October at 7 pm'; the drop time is written with src/lib/time/clock-time.js, which the provider's Availability screen also uses; the owner's unpublished preview reads the same function under their own client. Remove the sentence about service_role having select on availability_rule.
- 'Where rules are enforced' list: line 200 'and 15-minute working hours' becomes 'and 15-minute availability hours, start times and drop times'; lines 204-205 'notice, window, working hours, blocked dates, and overlap prevention' becomes 'notice, a date in an opened drop, its hours or start times, and overlap prevention'.
- Line 301: 'only Availability's drop editor does today'.
- Section 'Availability and booking boundary' (334-357, including 'weekly rules, blocked dates' at 337, 'local working period, blocked date, ... 60-day window' at 344-345 and 'stored working-period boundaries ... The 60-day window is fixed' at 355-356): rewrite for the new calculator inputs (open dates, occupied periods, duration), start-times rules, the same-day end, no window, the drop-time comparison with the clock on every read and hold, hours and start times stored on the same 15-minute grid, and booking_window_days unused and not writable.

docs/release.md
- Under Path, add a promotion step: before fast-forwarding main, set the Terms and Privacy 'updated' dates to the production promotion day.
- Under 'Before the first alpha invitation', add: tell any pilot provider that weekly hours and blocked dates are deleted when drops ship; rehearse a full drop on Preview (the owner signs in for the provider side) before a pilot provider's first drop, watching the reload of waiting booking screens.
- Note that migration 202609270001 drops the old availability tables, so Preview storefronts error between applying it and the new deploy finishing.

docs/decisions/001: add one line under Context: 'Availability rules changed in decision 007 (dates and drops); the protection described here is unchanged.' Do not rewrite anything else.

provider-experience.md: delete the sentence 'The current weekly-hours screen is legacy until it is rebuilt' (line 260).

SKILL.md line 118: replace the 'Availability can use expandable weekday rows' example with 'Availability lists drops with their dates'.

copy.md line 87: replace the 'No blocked dates.' example with 'No dates yet.'

ADDED BY THE LEAD SESSION AFTER REVIEW
- docs/design-system.md (about lines 154-155): the ConfirmDialog line names the Availability closed-week dialog as its pattern; name cancelling a booking instead.
- docs/release.md, 'Before the first alpha invitation': the Preview smoke-test list names storefront 'hours'; change it to 'availability'.

## Docs updated

- docs/product.md: the publishing requirement (a date from today on with times), the storefront Availability paragraph, 'When suits you?' (no Closed cards, no 60-day window, next-drop lines, reload at drop time, 'There are no more times.'), the availability-derivation and fixed-rules paragraphs, the /dashboard/availability paragraph (drops, Save, no warnings, the nothing-to-book notice replacing the all-closed confirmation and banner), and the not-implemented list
- docs/domain.md: an Availability definition with dates, hours, start times, drop and drop time; no booking window
- docs/architecture.md: the 'Where a change belongs' rows for availability, choosing a time and the public page; the storefront opening-hours read paragraph (lines 169-177) rewritten for get_public_availability_summary; the 'Where rules are enforced' list (lines 200 and 204-205: no window, working hours or blocked dates); the unsaved-changes note; the 'Availability and booking boundary' section
- docs/release.md: a promotion step for the Terms and Privacy 'updated' dates; tell pilot providers their weekly hours are deleted; the drop rehearsal on Preview; the migration-before-deploy error window
- docs/decisions/001-postgresql-protects-booking-integrity.md: a one-line pointer to decision 007
- provider-experience.md: remove the 'legacy weekly-hours screen' sentence
- SKILL.md: replace the stale weekday-rows example
- copy.md: replace the 'No blocked dates.' example with 'No dates yet.'
- src/app/(site)/terms/page.tsx and src/app/(site)/privacy/page.tsx: the approved legal copy and 'updated' dates (task T9)
- docs/design-system.md: the ConfirmDialog pattern line no longer names the deleted closed-week dialog

## Acceptance

| How | What must be seen |
|---|---|
| automated | npm test, npm run typecheck, npm run lint and npm run build pass, including the new tests: availability-drops, availability-drop-form, storefront-availability, legal-pages-copy and the rewritten appointment-availability and time-choices |
| database | npm run test:db passes on a fresh npx supabase db reset. availability_drops.test.sql shows: unopened dates are hidden by get_public_open_dates; the summary returns open drops plus only the next upcoming one; an upcoming drop named by its month returns only drop_month with first_date and last_date null, a range-named upcoming drop returns only the two dates its name shows, and no later upcoming drop's dates or drop time appear in any column; holds are refused on unopened, removed and out-of-hours dates and off-list start times; a hold 90 days ahead is accepted; the exclusion constraint still rejects overlaps; has_working_hours is true for a future unopened date |
| database | The rewritten provider_booking_counts test shows a hold whose date is removed after the hold still completes payment, while a new hold on that date is refused |
| browser | On a production build signed in as a test provider: add dates in one month, give them hours together, change one date to start times, choose Later, then Save. The drop reads 'Opens <date> at <time>'. Leaving with unsaved changes asks first. Removing every date deletes the drop, and 'No dates yet.' shows. A published page with no dates shows "Customers can't book: you have no open dates." |
| browser | Storefront /@username: an open drop reads '<Month> is open for booking' and the next reads '<Name> opens on <date> at <time>'. Nothing open and nothing coming leaves the section out. A paused page leaves it out. The owner's unpublished preview matches what the live page would show. In the browser network panel, the get_public_availability_summary response for an unopened month-named drop carries no exact dates |
| browser | 'When suits you?': only opened dates in the strip, Full and No times labels, the next-drop line above Full dates, 'No dates are open. …' when nothing is open, 'There are no more times.', and the screen refreshing by itself at a drop time set a few minutes ahead |
| browser | The setup guide and Settings → Publication show 'Add your availability' / 'At least one date from today on with times'; publishing succeeds with one future unopened date |
| browser | The Terms and Privacy pages show the approved sentences and the new 'updated' date |
| owner-keyboard | The owner's real-keyboard pass on Preview across the new Availability screen (month grid arrow and Tab order, Set times, Now/Later, Save), the storefront section and 'When suits you?', checking the unsettled wording listed in T5 and T7 |
| stripe | On Preview, a test-card payment for a time on a date in an opened drop reaches Confirmed through the webhook, and a hold on a date whose drop is moved later is refused with the 'taken' notice |
| owner-keyboard | Release step outside the build: the owner rehearses a full drop on Preview by 12 October, signed in as the provider |

## Risks

- The migration drops availability_rule and blocked_date, as decision 007 says. Between applying it to ceaute-dev and the new code deploying, the old Preview code reads the dropped table, so every Preview storefront and booking page errors. Production has no providers, and its storefront layout 404s before the view model runs, so production is unaffected. Apply the migration and merge together.
- has_working_hours keeps its name but now means 'a date from today on'. The name was kept to avoid dropping and re-granting two functions that return a table; a future reader may be misled, which the SQL and JS comments mitigate.
- Every waiting 'When suits you?' screen refreshes at the drop time, which is a load spike, as decision 007 notes. The refresh is timed from the server render time plus 2 seconds. A lagging database clock can cause a few extra refreshes, and waits longer than about 23 days are not scheduled. The Preview rehearsal must watch this.
- Review fix: get_public_availability_summary now returns only what each drop's name shows. For a month-named unopened drop it returns only the month; for a range-named one, the first and last dates its name displays anyway. What stays inferable is only what the settled naming rule itself shows: a range name for the next drop tells a reader that another current drop has dates in that month. That is inherent in owner-settled naming, not an extra column. The pgTAP test pins that no other dates are returned.
- The naming rule is now computed twice: in SQL (named_by_month in get_public_availability_summary) and in JS (namedDrops on the provider screen). If they disagree, the provider and customers see different names for the same drop. Both follow the one rule in provider-experience.md, and T2 and T4 test the same cases.
- The JavaScript calculator and the PostgreSQL hold check must agree. The same-day-end rule is now written as slot + duration < 24:00 in JS and as a local-date comparison in SQL. Around a DST change, wall-clock arithmetic in JS and instant arithmetic in SQL can differ. This already exists today, and the hold check stays authoritative.
- book/actions.js:217 matches the hold's exception text. The migration must keep 'Requested time is unavailable.' and 'Requested time is outside the booking rules.' verbatim, or a date removed or hidden between viewing and 'Continue to payment' would reach the error page instead of the 'taken' notice.
- With no window, deposits can be held for a long time before appointments, and a leaving provider may owe more refunds (decision 007, Consequences). This is accepted, not mitigated.
- The Terms and Privacy 'updated' date must equal the day the change reaches Preview. The builder may not know that day, so it must be corrected at merge, and again at promotion by the new release.md step.
- The provider screen (month grid, Set times, Now or Later) is the largest part of the build. Slipping it past 8 October moves Provider B's trial to the 15 November drop, per the owner's go or no-go.
- A concurrent save and hold on the same date are ordered by row locks on availability_date and availability_drop, taken with 'for share' in the hold and by update/delete in the save. A hold that loses the race may be refused and the customer picks again. That is acceptable, with no double booking, and the exclusion constraint still stands behind it.

## Review objections (on the first draft)

Blocking ones were fixed in the revision; the lead session applied the useful minor ones.

- **invariants, blocking:** get_public_availability_summary gives anyone the first and last dates of a drop that has not opened. That breaks the rule that PostgreSQL itself leaves out unopened dates and that only the next drop time is public.
- **invariants, minor:** The save and the hold take row locks in opposite orders, so a narrow race can deadlock. If the hold is the one Postgres aborts, the customer gets the error page instead of the 'taken' notice, and no race scenario covers it.
- **invariants, minor:** The database tests leave two access checks on the new security-definer functions untested.
- **invariants, minor:** T7 is not marked protected, although it writes the rows that decide which bookings are accepted. It goes to the unprotected implementer.
- **product-scope, blocking:** T1 step 7: get_public_availability_summary is granted to anon and returns first_date and last_date for the next drop, which has not opened yet. That breaks the brief's preserve rule that 'Dates of an unopened drop must be left out by PostgreSQL itself... only the next drop time is public'. It also goes against 'It never shows the dates of a drop before its drop time'. The naming rule does not need these dates. A drop named by its month ('November', even for 3, 10 and 17 November) shows only the month. Only a drop named by a range needs its first and last dates, and that name shows them anyway. The plan's risks call this 'slightly more than the drop time alone', but it goes against a stated preserve item. It is not a trade-off the brief allows.
- **product-scope, blocking:** The brief's docs_to_update lists 'the storefront opening-hours read' in docs/architecture.md. T10 does not cover it: it only says 'Public page row: add get_public_availability_summary'. The paragraph that describes the storefront reading availability_rule through availability-queries.js and opening-hours.js would stay. After T6 deletes those files and T1 drops the table, it would be false. The PostgreSQL responsibility list also still names 'window, working hours, blocked dates' as enforced rules.
- **product-scope, minor:** T5 step 4 says to render the next-drop line 'then the strip as today' when days exist but none has a free start. Today the component returns early for that case and never renders the strip. The plan does not say to narrow the early-return condition to days.length === 0. It does not say which day is selected when firstAvailableIndex is -1. It does not say what shows when everything open is full and no drop is coming. Without these, the builder could keep the old box, and the brief's 'above any Full dates' would be lost.
- **product-scope, minor:** T7 creates several visible labels and messages the brief does not settle, but marks only the page description '(plainest; owner checks)'. The labels are 'Edit', 'Set times', 'Change times', 'Add time', 'Hours' and 'Start times', 'Cancel', 'Add times for every date.' and 'That date is already in another drop.'. The acceptance item says to check 'the unsettled wording listed in T5 and T7', but T7 lists none of these. ceaute-product-design says an unsettled product decision is marked, not chosen silently.
- **product-scope, minor:** T10's file fence includes .agents/skills/ceaute-product-design/references/customer-experience.md but asks for no change to it. The brief's docs_to_update does not name the file, and it holds the owner's uncommitted edits, which already describe the new behaviour. Remove it from the fence, or mark it read-only, so the builder cannot rewrite the owner's text.
- **product-scope, minor:** Two references to the closed-week dialog, which T7 deletes, will go stale and are not in any task. Neither is in the brief's docs list, so this is optional. A one-line wording fix to each keeps them true, and it is cheaper now than later.
