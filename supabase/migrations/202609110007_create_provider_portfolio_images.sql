create table ceaute.portfolio_image (
  id uuid primary key default gen_random_uuid(),
  provider_page_id uuid not null references ceaute.provider_page (id) on delete restrict,
  storage_path text not null unique,
  caption varchar(250),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, provider_page_id)
);

create index portfolio_image_provider_order_idx
  on ceaute.portfolio_image (provider_page_id, display_order, created_at);

create trigger portfolio_image_set_updated_at
before update on ceaute.portfolio_image
for each row execute function ceaute.set_updated_at();

alter table ceaute.portfolio_image enable row level security;

revoke all on ceaute.portfolio_image from anon, authenticated;
grant select, insert, update, delete on ceaute.portfolio_image to authenticated;

create policy portfolio_image_select_own_provider
on ceaute.portfolio_image
for select
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = portfolio_image.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_image_insert_own_provider
on ceaute.portfolio_image
for insert
to authenticated
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = portfolio_image.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_image_update_own_provider
on ceaute.portfolio_image
for update
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = portfolio_image.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = portfolio_image.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_image_delete_own_provider
on ceaute.portfolio_image
for delete
to authenticated
using (
  exists (
    select 1
    from ceaute.provider_page
    where provider_page.id = portfolio_image.provider_page_id
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'portfolio-images',
  'portfolio-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy portfolio_images_select_own_provider
on storage.objects
for select
to authenticated
using (
  bucket_id = 'portfolio-images'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_images_insert_own_provider
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'portfolio-images'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_images_update_own_provider
on storage.objects
for update
to authenticated
using (
  bucket_id = 'portfolio-images'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
)
with check (
  bucket_id = 'portfolio-images'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);

create policy portfolio_images_delete_own_provider
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'portfolio-images'
  and exists (
    select 1
    from ceaute.provider_page
    where provider_page.id::text = (storage.foldername(name))[1]
      and provider_page.owner_profile_id = (select auth.uid())
  )
);
