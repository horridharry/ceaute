import {
  DetailSection,
  DetailTemplate,
} from "@/components/templates/detail-template";
import { ButtonLink } from "@/components/ui/button";
import { SettingRow } from "@/components/ui/setting-row";
import { StatusDot } from "@/components/ui/status";
import {
  getProviderPage,
  publishPage,
  unpublishPage,
  updateProviderPage,
} from "./actions";
import { ProviderPageForm } from "./_components/provider-page-form";
import { PublicationActions } from "./_components/publication-actions";
import { buildPublicationChecklist } from "../_lib/publication-checklist";

// B7: Page is where everything customers see is edited, so the portfolio,
// location and working hours are reached from here rather than from three
// separate items in a drawer.
export default async function DashboardProfilePage() {
  const { providerPage, publication } = await getProviderPage();
  const checklist = buildPublicationChecklist(publication.missing);

  return (
    <DetailTemplate
      title="Your page"
      meta={providerPage.username ? `ceaute.com/@${providerPage.username}` : undefined}
    >
      <div className="flex flex-col gap-3">
        <StatusDot
          status={providerPage.status}
          label={
            providerPage.status === "published"
              ? "Published"
              : `Draft · ${checklist.doneCount} / ${checklist.total} ready`
          }
        />
        {providerPage.status === "published" && providerPage.username ? (
          <ButtonLink
            href={`/@${providerPage.username}`}
            variant="tertiary"
            block={false}
            className="w-max px-6"
          >
            See it as a customer
          </ButtonLink>
        ) : (
          <ButtonLink href="/dashboard" variant="tertiary" block={false} className="w-max px-6">
            Publishing checklist
          </ButtonLink>
        )}
        <PublicationActions
          status={providerPage.status}
          ready={publication.ready}
          publishPage={publishPage}
          unpublishPage={unpublishPage}
        />
      </div>

      <DetailSection heading="Identity">
        <ProviderPageForm
          providerPage={providerPage}
          updateProviderPage={updateProviderPage}
        />
      </DetailSection>

      <DetailSection heading="What customers see">
        <SettingRow
          title="Portfolio"
          value="Photos on your page. The first is the hero."
          href="/dashboard/profile/portfolio"
        />
        <SettingRow
          title="Location"
          value="Public area on your page, private address after a confirmed booking."
          href="/dashboard/locations"
        />
        <SettingRow
          title="Working hours"
          value="One block per day, plus any blocked dates."
          href="/dashboard/availability"
        />
      </DetailSection>
    </DetailTemplate>
  );
}
