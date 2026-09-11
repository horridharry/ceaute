alter table ceaute.provider_payment_account
  drop column details_submitted,
  drop column charges_enabled,
  drop column payouts_enabled,
  drop column currently_due,
  add column dashboard text not null default 'express',
  add column identity_country text not null default 'GB',
  add column recipient_applied boolean not null default false,
  add column stripe_transfers_status text,
  add column payouts_status text,
  add column requirements_currently_due text[] not null default array[]::text[],
  add column requirements_past_due text[] not null default array[]::text[],
  add column requirements_eventually_due text[] not null default array[]::text[];

alter table ceaute.provider_payment_account
  add constraint provider_payment_account_dashboard_check
  check (dashboard in ('express')),
  add constraint provider_payment_account_identity_country_check
  check (identity_country = 'GB');
