# Preview acceptance script: drops and flat deposit

Dated snapshot, 27 September 2026. A step-by-step script for the hands-on
checks that drops ([decision 007](../decisions/007-availability-released-in-drops.md))
and the flat deposit ([decision 008](../decisions/008-flat-deposit.md)) still
need on Preview. It covers the browser, Stripe, email and owner-keyboard items
in the [drops plan](2026-09-27-drop-availability-plan.md) and the
[flat-deposit plan](2026-09-27-flat-deposit-plan.md). Record the results in a
new dated report, with each item verified, unverified or waived as
[Verification](../verification.md) describes; this file is not edited after
its date.

Preview is behind Vercel Deployment Protection, so the owner runs the script
in their own browser and signs in; agents do not sign in to Vercel. On
27 September both changes were on `preview` and both migrations
(`202609270001`, `202609270002`) were applied to `ceaute-dev`.

## Setup

1. Two browser windows on `https://preview.ceaute.com`:
   - **Provider**: signed in as a test provider whose page is published, with
     Stripe Test connected and the current agreement accepted (for example
     `cluxeklaws` on `ceaute-dev`).
   - **Customer**: a private window signed in as a different test account
     whose email you can read.
2. A treatment priced above £15, ideally £40, so the deposit arithmetic is
   easy to check.

## 1. Flat deposit settings (provider)

3. Settings → Booking settings → Deposit. Expected: Flat amount is offered
   first and selected by default, with Percentage beside it; a £ field; the
   explanation with the £40 example.
4. Enter £15, set the cancellation window to 48 hours, and save. The
   48-hour window, with the 24 hours' notice every booking needs, lets a
   booking 24–48 hours ahead test a late cancellation at once.

## 2. Create a drop (provider)

5. Availability → Add dates. Expected: the editor is its own page
   (`/dashboard/availability/new`) with an "Availability" link back.
6. Tap three dates: one about 36 hours ahead and two at least 3 days ahead.
   Set Hours by typing "10am" and "5pm". Expected: suggestions appear, and
   typing "7" offers 7 am and 7 pm.
7. Change one date to Start times, for example 10 am, 12 pm and 3 pm.
8. Choose Later: today, at the next quarter hour at least 10 minutes away.
   Save. Expected: back on the list, one card showing the drop's name,
   "Slots open on …" and "3 dates · 2 with hours, 1 with start times".
9. Press Edit, change nothing, and press the browser's Back. Expected: the
   list, with no question. Press Edit, change a time, and press Back.
   Expected: it asks before leaving.

## 3. The drop opening (customer)

10. Open the provider's page. Expected: Availability says "<name> slots open
    on <date> at <time>" and shows no dates.
11. Open the booking screen for the treatment. Expected: "No dates are open.
    <name> slots open on …". Leave it open; do not reload.
12. At the drop time. Expected: within a few seconds the dates appear by
    themselves. After a reload the storefront says "<name> slots are open for
    booking".

## 4. Book and pay (customer)

13. Choose a time on the date about 36 hours ahead, then Review and pay.
    Expected: "Deposit to pay now £15.00", "Pay <provider> at the appointment
    £25.00" and "<Provider> keeps your £15.00 deposit".
14. Pay with Stripe's test card 4242 4242 4242 4242, any future expiry and
    any CVC. Expected: "You're booked", confirmed through the webhook, and a
    confirmation email showing £15.
15. As the provider. Expected: the drop's card on Availability shows
    "1 booking"; the booking detail shows £15 paid online and £25 to collect.

## 5. Cancellations (customer)

16. Cancel the booking about 36 hours ahead, which is inside the 48-hour
    window. Expected: the dialog says the provider keeps the £15 paid and
    there is no refund.
17. Book a time at least 3 days ahead, then cancel it. Expected: "Cancel and
    refund £15.00", a full refund in Stripe Test, and cancellation emails with
    the right amounts.

## 6. Owner's keyboard pass

18. Keyboard only, on the Availability editor (month calendar, time fields,
    Now or Later, Save, Cancel) and Booking settings (Flat amount and
    Percentage radios, the £ field). Check the wording the build chose where
    no document settled it: "Set times", "Change times", "Add time",
    "hours vary by date", "start times vary by date", "Add times for every
    date.", "Type a time, like 7 pm or 19:00." and "Use a time on the quarter
    hour, like 7:15 pm."

## Optional

- A treatment cheaper than the deposit, for example £8 against £10.
  Expected: "Pay now £8.00", no at-the-appointment line, and "keeps the full
  £8.00".
- The review-to-hold check: while the customer is on Review and pay, change
  the deposit in the provider window, then Continue to payment. Expected:
  "Check the updated price", and Stripe does not open.
