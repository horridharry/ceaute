import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PersonalDetailsForm from "./personal-details-form";

export default async function AccountSettingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = data?.claims?.email;
  const name =
    typeof data?.claims?.user_metadata === "object" &&
    data.claims.user_metadata !== null &&
    "full_name" in data.claims.user_metadata
      ? String(data.claims.user_metadata.full_name)
      : null;

  if (!userId) {
    redirect("/sign-in?next=/account");
  }

  const { data: providerPage, error } = await supabase
    .schema("ceaute")
    .from("provider_page")
    .select("id")
    .eq("owner_profile_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load your account.");
  }

  const phone = "07342207772";
  return (
    <main className="container max-w-lg p-5 bg-white mx-auto">
      <div className="flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
        <p className="mt-1 opacity-70">
          Manage your personal details and account preferences
        </p>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tighter">
            Personal Details
          </h2>
          <PersonalDetailsForm name={name} phone={phone} email={email} />
        </div>

        <div className="mt-12">
          <h2 className="text-2xl font-semibold tracking-tighter">
            Manage account
          </h2>
          <div className="grid mt-6 gap-6">
            <div className="flex gap-2 items-start">
              <div className="flex-1">
                <p className="font-medium tracking-tight">Delete account</p>
                <p className="opacity-70 text-sm">
                  Permanently delete your Ceaute account
                </p>
              </div>
              <button className="text-sm font-medium cursor-pointer text-red-600 hover:underline">
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
