create unique index if not exists treatment_group_provider_name_unique
  on ceaute.treatment_group (provider_page_id, lower(btrim(name)));
