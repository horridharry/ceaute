// What the storefront's Availability section shows: every drop open for
// booking and, if another drop is still to come, only its name and opening
// time. PostgreSQL leaves out an unopened drop's dates itself, and returns
// only what each drop's name shows and only the next drop time; the owner's
// RLS client sees their own unpublished page through this same function.
export function availabilitySummaryQuery(supabase, providerPageId) {
  return supabase
    .schema("ceaute")
    .rpc("get_public_availability_summary", {
      target_provider_page_id: providerPageId,
    });
}
