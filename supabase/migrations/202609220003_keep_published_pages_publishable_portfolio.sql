-- A published page keeps at least one visible portfolio photo (approved
-- decision P1). The page is never unpublished as a side effect.
--
-- A published page must have at least one visible portfolio photo
-- (ceaute.provider_page_meets_publication_requirements). Today that is checked
-- only when publishing: the owner can afterwards delete or hide the last
-- visible photo directly (they hold DELETE and UPDATE on portfolio_image) and
-- the page stays published in a state that could not be published. Ceaute
-- must never silently unpublish a provider, so the only consistent rule is to
-- refuse the change and tell the provider why.
--
-- Draft pages are unaffected: a draft may have no photos.
--
-- Ceaute error code:
--   CE013  the change would leave a published page with no visible photo

create or replace function ceaute.keep_published_portfolio_visible()
returns trigger
language plpgsql
security definer
set search_path = ceaute, public
as $$
declare
  page_status text;
  other_visible integer;
begin
  -- Only removing a currently visible photo can break the rule.
  if tg_op = 'DELETE' and not old.is_visible then
    return old;
  end if;

  if tg_op = 'UPDATE' and not (old.is_visible and not new.is_visible) then
    return new;
  end if;

  -- Lock the page before counting. Two concurrent deletes of the last two
  -- visible photos then run one after the other, and the second sees the
  -- first. ceaute.publish_provider_page (202609120014) takes the same row
  -- FOR UPDATE before it checks the publication requirements, so publishing
  -- and removing photos are serialised in either order.
  select provider_page.status
  into page_status
  from ceaute.provider_page
  where provider_page.id = old.provider_page_id
  for update;

  if page_status = 'published' then
    select count(*)
    into other_visible
    from ceaute.portfolio_image
    where portfolio_image.provider_page_id = old.provider_page_id
      and portfolio_image.is_visible = true
      and portfolio_image.id <> old.id;

    if other_visible = 0 then
      raise exception 'A published page needs at least one visible portfolio photo.'
        using errcode = 'CE013';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function ceaute.keep_published_portfolio_visible()
from public, anon, authenticated, service_role;

create trigger portfolio_image_keep_published_page_valid
before delete or update of is_visible on ceaute.portfolio_image
for each row execute function ceaute.keep_published_portfolio_visible();
