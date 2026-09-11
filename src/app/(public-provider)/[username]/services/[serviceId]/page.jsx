import { TreatmentDetail } from "../_components/treatment-detail";
import { getPublicTreatmentPage } from "../../_lib/public-provider-data";
import { notFound } from "next/navigation";
import {
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../_lib/public-provider-format";

export default async function SingleTreatmentPage({ params }) {
  const { username, serviceId } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const { providerPage, treatment } = await getPublicTreatmentPage(
    decodedUsername,
    serviceId,
  );

  return (
    <TreatmentDetail
      treatment={treatment}
      providerPage={providerPage}
    />
  );
}

export async function generateMetadata({ params }) {
  const { username, serviceId } = await params;

  if (!hasPublicUsernamePrefix(username)) {
    return {};
  }

  const decodedUsername = normalizePublicUsername(username);
  const { treatment } = await getPublicTreatmentPage(
    decodedUsername,
    serviceId,
  );

  return {
    title: `${treatment.name} - Ceaute`,
    description: treatment.description || "Book this treatment on Ceaute.",
  };
}
