import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// One cookie-aware Supabase client and one verified-claims read per server
// render. React's cache() is scoped to the current request, so the root
// layout header, a dashboard page and the helpers it calls share this work
// instead of each verifying the session and looking the provider page up
// again. A Server Action runs outside that scope and always reads fresh data,
// so a mutation never sees a value memoised before it ran.
export const getRequestSession = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return { supabase, claims: data?.claims ?? null };
});

const OWNED_PROVIDER_PAGE_SELECT =
  "id, owner_profile_id, username, display_name, provider_category, biography, status";

// The provider page owned by the signed-in user, or null when they have not
// created one. A failed lookup throws rather than returning null so callers
// never mistake an error for "no provider page yet".
export const getOwnedProviderPage = cache(async (userId) => {
  const { supabase } = await getRequestSession();
  const { data: providerPage, error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select(OWNED_PROVIDER_PAGE_SELECT)
    .eq("owner_profile_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load provider workspace.");
  }

  return providerPage ?? null;
});
