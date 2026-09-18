# Ceaute email templates

Seven send-ready HTML emails. Open `index.html` to see them all side by side.

Table layout, inline styles, system font stack, 600px wide with one mobile breakpoint at
620px. No web fonts (Geist will not load in Outlook), no images, no external CSS, no dark-mode
inversion (`color-scheme: light only`). Each file has a hidden preheader line.

## Files

| File | Event | Recipient |
| --- | --- | --- |
| `1-booking-confirmed-customer.html` | `booking_confirmed` | customer |
| `2-booking-confirmed-provider.html` | `booking_confirmed` | provider |
| `3-customer-cancelled-customer.html` | `customer_cancelled` | customer |
| `4-provider-cancelled-customer.html` | `provider_cancelled` | customer |
| `5-customer-cancelled-provider.html` | `customer_cancelled` | provider |
| `6-provider-cancelled-provider.html` | `provider_cancelled` | provider |
| `7-signin-code-supabase.html` | sign-in code | anyone |

Templates 1–6 replace the rendering in `src/lib/emails/email-layout.js`. The content
contract in `booking-email-content.js` is unchanged — same facts, same withholding rules.
Template 7 is pasted into the Supabase **Magic Link / OTP** email template, not the repo.

## Placeholders

`{{token}}` in templates 1–6. Swap the delimiters for whatever the mailer uses.

**Shared:** `customer_first_name` `customer_full_name` `customer_email` `customer_phone`
`customer_phone_e164` `provider_name` `treatment_name` `add_ons_list` `duration`
`appointment_weekday` `appointment_date` `appointment_day_long` `appointment_day_short`
`start_time` `end_time` `booking_url` `booking_url_display` `dashboard_bookings_url`
`provider_url` `discover_url`

**Money:** `amount_paid` `amount_due` `total_price` `refund_amount` `retained_amount`
`cancellation_deadline_long`

**Confirmation only:** `address_single_line` `address_urlencoded` `access_instructions`

**Cancellation only:** `cancelled_at_long`

**Template 4 only:** `alternatives_sentence` — e.g. *"Three other nail techs in Salford
have Wednesday free."* This is the one new query: same availability calculation Discover
already runs, filtered to category + area + that date. If you do not want to build it yet,
delete that block; the email still works.

Template 7 uses Supabase's own `{{ .Token }}`.

Amounts arrive **pre-formatted with the £ sign** (`£10.00`). Never interpolate a bare
number — the copy reads as a sentence.

## Conditionals

`{{#add_ons}} with {{add_ons_list}}{{/add_ons}}` in templates 1 and 2 — omit the clause
when there are none. Rewrite for your templating language.

## Variants you will need

**Template 3, refund-retained case.** As written it assumes a full refund. When the
customer cancels late, change the headline to
`{{provider_name}} keeps {{retained_amount}} of your {{amount_paid}}.`, the status block to
green / `Settled` with `{{refund_amount}} is on its way back; {{retained_amount}} stays
with {{provider_name}} under the {{cancellation_window}}-hour policy.`, and drop the amber
dot. Everything else holds.

**Templates 3 and 6, refund-status block.** Three states, swap the dot colour and copy:

| State | Dot | Title |
| --- | --- | --- |
| pending | `#c98a1a` | Refund processing with Stripe |
| failed | `#b3261e` | The first refund attempt failed. Ceaute is retrying it. |
| settled / none due | `#2f6f4f` | Settled — no refund due |

## Rules preserved from the current code

- Cancellation emails contain **no private address**.
- Only provider emails carry the customer's email and phone.
- Every fact in the HTML must also appear in the plain-text alternative.

## Two changes from what ships today

1. **Provider confirmations no longer show the address.** She knows her own street; the
   space goes to the customer's name and number, which is what she actually needs. Her
   money lines are also phrased from her side: *"is in your Stripe"*, *"Collect on the day"*.
2. **Provider-cancelled emails lead with "Find another time."** This is the one case where
   Ceaute has let the customer down, and the copy says outright that a provider
   cancellation never keeps anything.

## Plain text

Not included — generate it from the same content object rather than stripping tags, so a
fact can never appear in one and not the other. Keep the order: headline, date and time,
treatment, address (confirmations only), money, deadline, link.

## Before sending

- Test in Outlook 2016+, Gmail (web and app), Apple Mail, and one Android client.
- Check the preheader is not duplicating the headline in the inbox list.
- Confirm `tel:` and `mailto:` links work on a real phone.
- Check the 46px time and 54px code do not wrap at 320px.
