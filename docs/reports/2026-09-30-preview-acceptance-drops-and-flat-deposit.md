# Preview acceptance: drops and flat deposit, 30 September 2026

Results of sections 2–5 of the
[acceptance script](2026-09-27-preview-acceptance-drops-and-flat-deposit.md),
run on Preview (`preview` at a5c05a3) after `ceaute-dev` and the Stripe Test
sandbox were wiped on 29 September. The owner set up a new test provider from
sign-up (`@cluxeklaws`, £15 flat deposit, 48-hour window) and drove the provider
and customer windows; the agent checked the public pages with `vercel curl` and
the Stripe records with read-only `stripe` CLI calls in the "Ceaute Dev"
sandbox.

| Item | Result | Evidence |
| --- | --- | --- |
| Drop editor, save and list card (steps 5–8) | Verified by the owner | Drop "October" saved with a 6:15 pm drop time |
| Storefront before the drop (step 10) | Verified | "October slots open on 30 September at 6:15 pm" (agent and owner) |
| Booking screen before the drop (step 11) | Verified | Owner's screenshot at 18:14: "No dates are open. October slots open on 30 September at 6:15 pm." |
| Dates appear at the drop time without a reload (step 12) | Verified | Owner's screenshot at 18:15 shows Fri 2 and Sat 3 October with times; owner confirms no reload. Storefront then said "October slots are open for booking" |
| Edit then Back, with and without changes (step 9) | Unverified | Not reported |
| Book and pay £15 deposit (steps 13–14) | Verified | `pi_3ULR7b…` £15.00 succeeded 18:16:47; `checkout.session.completed` delivered, no pending webhooks; owner saw the booking paid and the confirmation email |
| Ceaute fee on £15 | Verified | `application_fee_amount` 73p = 2% (30p) + estimated Stripe 1.5% + 20p (43p) |
| Late customer cancellation (step 16) | Verified | No refund on `ch_3ULR7b…`; fee 73p kept; transfer £15 not reversed. Emails to customer and provider arrived |
| Early customer cancellation (step 17) | Verified | `pi_3ULku7…` £15 refunded in full; fee 73p refunded; transfer £15 reversed. Emails arrived |
| Booking settings by keyboard (part of step 18) | Verified by the owner | Flat amount/Percentage radios and £ field |
| Drop card "1 booking", £36 to collect (step 15) | Unverified | Owner saw the booking as paid; the counts were not reported |
