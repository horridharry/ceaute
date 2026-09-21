import { redirect } from "next/navigation";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";
import { updatePersonalDetails } from "./actions";
import PersonalDetailsForm from "./personal-details-form";
import { SettingsSectionNav } from "@/features/navigation/settings-section-nav";

export default async function AccountSettingsPage() {
  const { supabase, claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect("/sign-in?next=/account/settings");
  }

  const { data: profile, error } = await supabase
    .schema("ceaute")
    .from("profile")
    .select("full_name, phone_e164")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load your details.");
  }

  const providerPage = await getOwnedProviderPage(userId);

  return (
    <main className="container max-w-lg p-5 bg-white mx-auto">
      <div className="mt-6 flex flex-col">
        {providerPage ? (
          <SettingsSectionNav />
        ) : (
          <h1 className="text-3xl font-bold tracking-tighter">Account</h1>
        )}

        <div className="mt-8">
          <h2 className="text-2xl font-semibold tracking-tighter">
            Personal details
          </h2>
          <PersonalDetailsForm
            fullName={profile?.full_name ?? ""}
            phone={profile?.phone_e164 ?? ""}
            email={typeof claims?.email === "string" ? claims.email : ""}
            updatePersonalDetails={updatePersonalDetails}
          />
        </div>
      </div>
    </main>
  );
}
