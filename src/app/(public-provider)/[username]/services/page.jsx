import { TreatmentList } from "./_components/treatment-list";
import { getPublicProviderCatalogue } from "../_lib/public-provider-data";
import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../_lib/public-provider-format";

export default async function TreatmentsPage({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const { providerPage, treatments } =
    await getPublicProviderCatalogue(decodedUsername);

  return (
    <TreatmentList
      treatments={treatments}
      providerPage={providerPage}
    />
  );
}

export async function generateMetadata({ params }) {
  const { username } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    return {};
  }

  const decodedUsername = normalizePublicUsername(username);
  const { providerPage } = await getPublicProviderCatalogue(decodedUsername);

  return {
    title: `${providerPage.display_name ?? `@${decodedUsername}`} services - Ceaute`,
    description:
      providerPage.biography ??
      `Book beauty treatments with @${decodedUsername} on Ceaute.`,
  };
}
