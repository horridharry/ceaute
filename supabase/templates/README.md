# Supabase Auth email templates

`confirmation.html` (Dashboard name: **Confirm signup**) and `magic_link.html`
(**Magic Link**) carry the six-digit code Supabase generates for
`signInWithOtp`. A new email receives the first template and a returning user
the second, so both must show the code.

`supabase/config.toml` loads these files for the local stack only. The hosted
project does not read them: paste each file into Authentication > Emails in
the Supabase Dashboard, and set the Email OTP length to 6 and the expiry to
900 seconds under Authentication > Sign In / Providers > Email.

The templates must contain the token variable and must not contain the
confirmation URL variable, even inside an HTML comment, because Supabase
expands template variables everywhere in the file. A link can be opened by a
mail scanner, or in a different browser from the one that asked for it, and
either spends the one-time token before the customer can use it.
