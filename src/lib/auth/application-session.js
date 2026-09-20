/**
 * An authenticated application session is valid only when the auth identity
 * has the profile row created by the signup bootstrap.
 *
 * @param {{
 *   supabase: import("@supabase/supabase-js").SupabaseClient,
 *   userId: string,
 * }} input
 */
export async function enforceApplicationProfileSession({ supabase, userId }) {
  const { data: profile, error } = await supabase
    .schema("ceaute")
    .from("profile")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not validate application session.");
  }

  if (profile) {
    return true;
  }

  await supabase.auth.signOut();
  return false;
}
