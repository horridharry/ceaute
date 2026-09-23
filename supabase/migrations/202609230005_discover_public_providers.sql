-- Discover lists every published provider before any search, 24 at a time,
-- with the bento card chosen on 23 September 2026: up to three visible
-- portfolio photos, the optional display photo, the business name, the public
-- area and genuine review figures.
--
-- Same matching rules as search_public_providers (202609200001): published,
-- a username, a complete active current location, at least one active
-- treatment, optional public-area text and discovery category. Only public
-- fields leave the database; storage paths are signed on the server.
--
-- Reviews are returned as a count and a total so the application formats the
-- average with the same helper the storefront uses; nothing is invented when a
-- provider has no visible review.
--
-- search_public_providers is left in place for the previous deployment and is
-- no longer called by this one.

create function ceaute.discover_public_providers(
  area_query text default null,
  discovery_category_slug_query text default null,
  result_limit integer default 24,
  result_offset integer default 0
)
returns table (
  username varchar,
  display_name varchar,
  public_area varchar,
  display_photo_path text,
  portfolio_storage_paths text[],
  review_count integer,
  rating_total integer,
  total_count bigint
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  with normalized_input as (
    select
      nullif(left(btrim(coalesce(area_query, '')), 120), '') as area,
      nullif(left(btrim(coalesce(discovery_category_slug_query, '')), 100), '') as category_slug,
      least(greatest(coalesce(result_limit, 24), 1), 96) as page_size,
      greatest(coalesce(result_offset, 0), 0) as page_offset
  ),
  selected_category as (
    select discovery_category.id
    from ceaute.discovery_category, normalized_input
    where discovery_category.is_active = true
      and discovery_category.slug = normalized_input.category_slug
  ),
  matched_providers as (
    select
      provider_page.id,
      provider_page.username,
      provider_page.display_name,
      provider_page.display_photo_path,
      provider_location.public_area
    from ceaute.provider_page
    join ceaute.provider_location
      on provider_location.provider_page_id = provider_page.id
      and provider_location.is_active = true
      and provider_location.is_primary = true
    cross join normalized_input
    where provider_page.status = 'published'
      and provider_page.username is not null
      and (
        normalized_input.area is null
        or lower(provider_location.public_area) like '%' || replace(replace(replace(lower(normalized_input.area), '\', '\\'), '%', '\%'), '_', '\_') || '%' escape '\'
      )
      and (
        normalized_input.category_slug is null
        or (
          exists (select 1 from selected_category)
          and exists (
            select 1
            from ceaute.treatment
            join selected_category
              on selected_category.id = treatment.discovery_category_id
            where treatment.provider_page_id = provider_page.id
              and treatment.is_active = true
          )
        )
      )
      and exists (
        select 1
        from ceaute.treatment
        where treatment.provider_page_id = provider_page.id
          and treatment.is_active = true
      )
  ),
  counted as (
    select matched_providers.*, count(*) over () as total_count
    from matched_providers
  ),
  page as (
    select counted.*
    from counted, normalized_input
    order by counted.display_name, counted.username
    limit (select page_size from normalized_input)
    offset (select page_offset from normalized_input)
  )
  select
    page.username,
    page.display_name,
    page.public_area,
    page.display_photo_path,
    coalesce(
      (
        select array_agg(photo.storage_path order by photo.display_order, photo.created_at)
        from (
          select portfolio_image.storage_path, portfolio_image.display_order, portfolio_image.created_at
          from ceaute.portfolio_image
          where portfolio_image.provider_page_id = page.id
            and portfolio_image.is_visible = true
          order by portfolio_image.display_order, portfolio_image.created_at
          limit 3
        ) as photo
      ),
      array[]::text[]
    ),
    coalesce(reviews.review_count, 0)::integer,
    coalesce(reviews.rating_total, 0)::integer,
    page.total_count
  from page
  left join lateral (
    select count(*) as review_count, sum(booking_review.rating) as rating_total
    from ceaute.booking_review
    where booking_review.provider_page_id = page.id
      and booking_review.is_visible = true
  ) as reviews on true
  order by page.display_name, page.username;
$$;

revoke all on function ceaute.discover_public_providers(text, text, integer, integer)
from public, anon, authenticated, service_role;

grant execute on function ceaute.discover_public_providers(text, text, integer, integer)
to service_role;

comment on function ceaute.discover_public_providers(text, text, integer, integer) is
  'Public projection for Discover: published providers only, public fields only, paged.';
