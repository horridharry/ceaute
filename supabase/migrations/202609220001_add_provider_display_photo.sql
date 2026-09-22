-- Optional provider display photo, managed in Profile and stored separately
-- from Portfolio. It is not a publication requirement.
--
-- The column holds a storage path in the provider-display-photos bucket. The
-- check keeps it inside the page's own folder and in the shape the Profile
-- action writes ({provider_page_id}/{uuid}.{jpg|png|webp}), so an owner can
-- only point it at an object in their own folder. No backfill: every page
-- starts without a photo.

alter table ceaute.provider_page
  add column display_photo_path text;

alter table ceaute.provider_page
  add constraint provider_page_display_photo_path_own_folder
  check (
    display_photo_path is null
    or (
      display_photo_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$'
      and split_part(display_photo_path, '/', 1) = id::text
    )
  );

-- Owners already update their identity fields directly under the
-- ownership-scoped update policy; add only this column to what they may set.
grant update (display_photo_path) on table ceaute.provider_page to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'provider-display-photos',
  'provider-display-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Objects live under {provider_page_id}/..., and only that page's owner can
-- read, add, replace or remove them. The public storefront signs the photo
-- with the service role, and only for a published page.
create policy provider_display_photos_select_own_provider
on storage.objects
for select
to authenticated
using (
  bucket_id = 'provider-display-photos'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_display_photos_insert_own_provider
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-display-photos'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_display_photos_update_own_provider
on storage.objects
for update
to authenticated
using (
  bucket_id = 'provider-display-photos'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'provider-display-photos'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy provider_display_photos_delete_own_provider
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-display-photos'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
