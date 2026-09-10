insert into ceaute.discovery_category (name, slug, search_terms, display_order)
values
  ('Acrylic nails', 'acrylic-nails', array['acrylic nails'], 10),
  ('Gel nails', 'gel-nails', array['gel nails'], 20),
  ('BIAB nails', 'biab-nails', array['biab nails'], 30),
  ('Manicure', 'manicure', array['manicure'], 40),
  ('Pedicure', 'pedicure', array['pedicure'], 50),
  ('Lash extensions', 'lash-extensions', array['lash extensions'], 60),
  ('Lash lifts', 'lash-lifts', array['lash lifts'], 70),
  ('Braids', 'braids', array['braids'], 80),
  ('Locs', 'locs', array['locs'], 90),
  ('Wig installation', 'wig-installation', array['wig installation'], 100),
  ('Weaves', 'weaves', array['weaves'], 110),
  ('Natural hair styling', 'natural-hair-styling', array['natural hair styling'], 120),
  ('Brow treatments', 'brow-treatments', array['brow treatments'], 130),
  ('Facials', 'facials', array['facials'], 140),
  ('Makeup', 'makeup', array['makeup'], 150)
on conflict (slug) do update set
  name = excluded.name,
  search_terms = excluded.search_terms,
  display_order = excluded.display_order,
  is_active = true;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'treatment-images',
  'treatment-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists treatment_images_insert_own_provider on storage.objects;
drop policy if exists treatment_images_update_own_provider on storage.objects;
drop policy if exists treatment_images_delete_own_provider on storage.objects;

create policy treatment_images_insert_own_provider
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'treatment-images'
  and exists (
    select 1
    from ceaute.provider_page
    join ceaute.treatment
      on treatment.provider_page_id = provider_page.id
    where provider_page.id::text = (storage.foldername(name))[1]
      and treatment.id::text = (storage.foldername(name))[2]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_images_update_own_provider
on storage.objects
for update
to authenticated
using (
  bucket_id = 'treatment-images'
  and exists (
    select 1
    from ceaute.provider_page
    join ceaute.treatment
      on treatment.provider_page_id = provider_page.id
    where provider_page.id::text = (storage.foldername(name))[1]
      and treatment.id::text = (storage.foldername(name))[2]
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'treatment-images'
  and exists (
    select 1
    from ceaute.provider_page
    join ceaute.treatment
      on treatment.provider_page_id = provider_page.id
    where provider_page.id::text = (storage.foldername(name))[1]
      and treatment.id::text = (storage.foldername(name))[2]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy treatment_images_delete_own_provider
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'treatment-images'
  and exists (
    select 1
    from ceaute.provider_page
    join ceaute.treatment
      on treatment.provider_page_id = provider_page.id
    where provider_page.id::text = (storage.foldername(name))[1]
      and treatment.id::text = (storage.foldername(name))[2]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
