create index if not exists provider_location_public_area_idx
  on ceaute.provider_location (lower(public_area))
  where is_active;

create or replace function ceaute.search_public_providers(
  area_query text default null,
  discovery_category_slug_query text default null
)
returns table (
  username varchar,
  display_name varchar,
  provider_category varchar,
  public_area varchar,
  portfolio_storage_path text,
  matching_treatments jsonb
)
language sql
security definer
set search_path = ceaute, public
stable
as $$
  with normalized_input as (
    select
      nullif(left(btrim(coalesce(area_query, '')), 120), '') as area,
      nullif(left(btrim(coalesce(discovery_category_slug_query, '')), 100), '') as category_slug
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
      provider_page.provider_category,
      provider_location.public_area
    from ceaute.provider_page
    join ceaute.provider_location
      on provider_location.provider_page_id = provider_page.id
      and provider_location.is_active = true
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
  )
  select
    matched_providers.username,
    matched_providers.display_name,
    matched_providers.provider_category,
    matched_providers.public_area,
    (
      select portfolio_image.storage_path
      from ceaute.portfolio_image
      where portfolio_image.provider_page_id = matched_providers.id
        and portfolio_image.is_visible = true
      order by portfolio_image.display_order, portfolio_image.created_at
      limit 1
    ) as portfolio_storage_path,
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'name', treatment.name,
            'price_pence', treatment.price_pence
          )
          order by treatment.display_order, treatment.name
        )
        from ceaute.treatment
        cross join normalized_input
        left join selected_category
          on true
        where treatment.provider_page_id = matched_providers.id
          and treatment.is_active = true
          and (
            normalized_input.category_slug is null
            or (
              selected_category.id is not null
              and treatment.discovery_category_id = selected_category.id
            )
          )
      ),
      '[]'::jsonb
    ) as matching_treatments
  from matched_providers
  order by matched_providers.display_name, matched_providers.username;
$$;

revoke all on function ceaute.search_public_providers(text, text)
from public, anon, authenticated;

grant execute on function ceaute.search_public_providers(text, text)
to anon, authenticated;
