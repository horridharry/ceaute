import { redirect } from "next/navigation";
import {
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { logoutUser } from "@/app/(authenticate)/actions";
import { SettingRow } from "@/components/ui/setting-row";
import { SubmitButton } from "@/components/ui/submit-button";
import { StackedTopBar } from "@/components/ui/top-bar";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";
import { updatePersonalDetails } from "./actions";
import PersonalDetailsForm from "./personal-details-form";

export default async function AccountSettingsPage() {
  const { supabase, claims } = await getRequestSession();
  const userId = claims?.sub;

  if (!userId) {
    redirect("/sign-in?next=/account/settings");
  }

  const [{ data: profile, error }, providerPage] = await Promise.all([
    supabase
      .schema("ceaute")
      .from("profile")
      .select("full_name, phone_e164")
      .eq("id", userId)
      .maybeSingle(),
    getOwnedProviderPage(userId).catch(() => null),
  ]);

  if (error) {
    throw new Error("Could not load your details.");
  }

  const email = typeof claims?.email === "string" ? claims.email : "";

  return (
    <DetailTemplate
      nav={<StackedTopBar backHref="/account/bookings" backLabel="Bookings" />}
      title="Account"
      meta={email ? `Signed in as ${email}` : undefined}
    >
      <DetailSection heading="Personal details" divider={false}>
        <PersonalDetailsForm
          fullName={profile?.full_name ?? ""}
          phone={profile?.phone_e164 ?? ""}
          email={email}
          updatePersonalDetails={updatePersonalDetails}
        />
      </DetailSection>

      <DetailSection heading={providerPage ? "Your page" : "Take bookings yourself"}>
        <SettingRow
          title={
            providerPage
              ? providerPage.display_name || "Your provider page"
              : "Set up a provider page"
          }
          value={
            providerPage
              ? `Same account · @${providerPage.username ?? ""}`
              : "Same account — no second login."
          }
          href={providerPage ? "/dashboard" : "/dashboard/onboarding"}
        />
      </DetailSection>

      <DetailSection heading="Account">
        <form action={logoutUser}>
          <SubmitButton variant="tertiary" pendingLabel="Signing out">
            Sign out
          </SubmitButton>
        </form>

        {/* D9: the design shows "Delete account", but no deletion process
            exists — no route, no action, no migration. Offering it would be a
            button that does nothing with a promise behind it, so the row says
            what actually happens instead. */}
        <SettingRow
          title="Close your account"
          value="Email Ceaute and your account and bookings are dealt with by hand."
          action="edit"
        >
          <a
            href="mailto:ndu.harry02@gmail.com?subject=Close%20my%20Ceaute%20account"
            className="shrink-0 text-[13px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
          >
            Email
          </a>
        </SettingRow>
      </DetailSection>
    </DetailTemplate>
  );
}
