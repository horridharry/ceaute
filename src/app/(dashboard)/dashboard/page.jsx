import { getProviderDiary } from "./bookings/actions";
import { publishPage } from "./profile/actions";
import { getProviderPagePublicationReadiness } from "./profile/publication-readiness";
import { getSignedInProvider } from "./_lib/provider-data";
import { buildPublicationChecklist } from "./_lib/publication-checklist";
import { DashboardToday } from "./_components/dashboard-today";
import { PublishingChecklist } from "./_components/publishing-checklist";
import { PublishedLetter } from "./_components/published-letter";

export default async function DashboardTodayPage({ searchParams }) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const { supabase, providerPage } = await getSignedInProvider();

  // Before publishing, Today has nothing to show and the checklist is the
  // screen that matters.
  if (providerPage.status !== "published") {
    const readiness = await getProviderPagePublicationReadiness({
      supabase,
      providerPage,
    });

    return (
      <PublishingChecklist
        checklist={buildPublicationChecklist(readiness.missing)}
        publishAction={publishPage}
      />
    );
  }

  // The letter only follows an actual publish: the checklist navigates here
  // with ?published=1 once publish_provider_page has accepted.
  if (resolvedSearchParams.published === "1") {
    const { count } = await supabase
      .schema("ceaute")
      .from("treatment")
      .select("id", { count: "exact", head: true })
      .eq("provider_page_id", providerPage.id)
      .eq("is_active", true);

    return (
      <PublishedLetter
        providerName={providerPage.display_name || "Your page"}
        username={providerPage.username}
        treatmentCount={count ?? 0}
      />
    );
  }

  const { todayLabel, today, nextUp } = await getProviderDiary();

  return (
    <DashboardToday
      todayLabel={todayLabel}
      today={today}
      nextUp={nextUp}
      username={providerPage.username}
    />
  );
}
