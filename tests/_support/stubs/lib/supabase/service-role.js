// Test stand-in for src/lib/supabase/service-role.ts. Unit tests inject a fake
// client; reaching this default means a code path forgot to accept one.
export function createServiceRoleClient() {
  throw new Error("Unit tests must inject a Supabase client.");
}
