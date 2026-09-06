begin;

select plan(6);

select has_schema('ceaute', 'Ceaute uses its own schema');
select has_table('ceaute', 'profile', 'Profiles exist');
select has_table('ceaute', 'provider_page', 'Provider drafts exist');
select col_is_pk('ceaute', 'profile', 'id', 'Profile IDs are unique auth identities');
select col_is_unique(
  'ceaute',
  'provider_page',
  'owner_profile_id',
  'An account can own only one provider page'
);
select policies_are(
  'ceaute',
  'provider_page',
  array[
    'provider_page_insert_own',
    'provider_page_select_own',
    'provider_page_update_own'
  ],
  'Provider-page access is ownership-scoped'
);

select * from finish();
rollback;
