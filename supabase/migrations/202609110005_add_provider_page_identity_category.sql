alter table ceaute.provider_page
  add column provider_category text,
  add constraint provider_page_provider_category_allowed check (
    provider_category is null
    or provider_category in ('Nails', 'Lashes', 'Hair', 'Brows', 'Skincare', 'Makeup')
  );
