import { createClient } from "@/lib/supabase/server";

export async function getSignedInCustomer() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const profileId = data?.claims?.sub;

  if (!profileId) {
    throw new Error("Sign in to continue.");
  }

  return { supabase, profileId };
}
