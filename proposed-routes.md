CONSUMER SHELL (public, no auth required except where marked)
├── / → landing / discover entry
├── /discover → browse & search stylists
├── /@username → provider's public profile (bio, portfolio, treatments, reviews)
├── /@username/book/[treatmentId] → treatment details + add-ons
├── /@username/book/[treatmentId]/time → pick a slot
│ ── auth gate ──
├── /@username/book/[treatmentId]/checkout → confirm + pay (auth required)
└── /bookings/[bookingId] → confirmation / booking detail (auth required)

ACCOUNT SHELL (auth required, belongs to the User regardless of Provider status)
├── /bookings → list of the User's own bookings (as customer)
└── /account
├── /account → email, password, phone
├── /account/notifications → notification preferences
├── /account/become-provider → create Provider profile
└── /account/delete → deactivate / delete account

PROVIDER DASHBOARD SHELL (auth required + Provider profile must exist)
├── /dashboard → overview / today's bookings at a glance
├── /dashboard/bookings → bookings received (provider-side, distinct from /bookings)
├── /dashboard/treatments → CRUD treatments
├── /dashboard/treatment-groups → CRUD groups, assign treatments
├── /dashboard/add-ons → CRUD add-ons (if managed independently — see note below)
├── /dashboard/availability → weekly hours + blocked dates/holidays
├── /dashboard/locations → only if multi-location is supported (see note below)
├── /dashboard/portfolio → upload/reorder/delete images
├── /dashboard/profile → bio, business name, username, storefront-facing info
└── /dashboard/settings
├── /dashboard/settings/payouts → bank/payout details
├── /dashboard/settings/policies → cancellation window, deposits, buffer time
└── /dashboard/settings/deactivate → stop taking bookings
