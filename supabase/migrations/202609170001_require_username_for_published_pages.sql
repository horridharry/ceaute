-- A published page is reached at /@username. publish_provider_page already
-- requires a username at publication time, but the username column stays
-- writable by the owner afterwards, so a page-identity edit could clear it and
-- leave a live page without an address while it still reported "published".
-- This constraint keeps the rule for as long as the page stays published.
-- Draft and suspended pages may still have no username.
alter table ceaute.provider_page
  add constraint provider_page_published_requires_username
  check (status <> 'published' or username is not null);

comment on constraint provider_page_published_requires_username
  on ceaute.provider_page is
  'A published page must keep a username; unpublish before clearing it.';
