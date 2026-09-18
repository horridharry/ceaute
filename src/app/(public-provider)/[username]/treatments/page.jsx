import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ListTemplate } from "@/components/templates/list-template";
import { Chip, ChipRow } from "@/components/ui/chip";
import { StackedTopBar } from "@/components/ui/top-bar";
import { TreatmentSelectionList } from "../_components/treatment-selection";
import { buildStorefrontViewModel } from "../_lib/storefront-view-model";
import { getPublishedProviderPageByUsername } from "../_lib/public-provider-data";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../_lib/public-provider-format";

// T1 · List. The full treatment list on its own page, because 21 treatments
// across 8 groups is too long a scroll to sit between the portfolio and the
// reviews on the provider page.
//
// The group filter is a URL parameter rather than client state on purpose: a
// provider can link one group straight from her Instagram story, and the
// selection survives a share and the back button.
export async function generateMetadata({ params }) {
  const { username } = await params;

  return { title: `Treatments · @${normalizePublicUsername(username)} · Ceaute` };
}

export default async function ProviderTreatmentsPage({ params, searchParams }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const resolvedSearchParams = (await searchParams) ?? {};
  const selectedGroup = String(resolvedSearchParams.group ?? "").trim();

  const supabase = createServiceRoleClient();
  const providerPage = await getPublishedProviderPageByUsername(decodedUsername);
  const viewModel = await buildStorefrontViewModel({ supabase, providerPage });

  const allSections = viewModel.treatment_sections;
  const treatmentCount = allSections.reduce(
    (total, section) => total + section.treatments.length,
    0,
  );
  const groupNames = allSections
    .map((section) => section.name)
    .filter(Boolean);

  const sections = selectedGroup
    ? allSections.filter((section) => section.name === selectedGroup)
    : allSections;

  const groupHref = (group) =>
    group
      ? `/@${decodedUsername}/treatments?group=${encodeURIComponent(group)}`
      : `/@${decodedUsername}/treatments`;

  return (
    <>
      <div className="mx-auto w-full max-w-[720px] px-5">
        <StackedTopBar
          backHref={`/@${decodedUsername}`}
          backLabel={viewModel.provider.business_name || `@${decodedUsername}`}
        />
      </div>

      <ListTemplate
        title="Treatments"
        meta={
          groupNames.length
            ? `${treatmentCount} across ${groupNames.length} ${groupNames.length === 1 ? "group" : "groups"}`
            : `${treatmentCount} ${treatmentCount === 1 ? "treatment" : "treatments"}`
        }
        filters={
          groupNames.length > 1 ? (
            <ChipRow>
              <Chip label="All" href={groupHref("")} selected={!selectedGroup} />
              {groupNames.map((group) => (
                <Chip
                  key={group}
                  label={group}
                  href={groupHref(group)}
                  selected={group === selectedGroup}
                />
              ))}
            </ChipRow>
          ) : null
        }
      >
        <TreatmentSelectionList
          sections={sections}
          username={decodedUsername}
        />
      </ListTemplate>
    </>
  );
}
