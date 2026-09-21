import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function buildReturnPath(path) {
  return `/sign-in?next=${encodeURIComponent(path)}`;
}

export async function getSignedInCustomer(next) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect(buildReturnPath(next));
  }

  return { supabase, userId };
}
