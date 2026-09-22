import { getAllTreatments } from "./queries";
import { TreatmentsUI } from "./_components/treatments-page";

export default async function TreatmentsPage() {
  const { treatments, groups } = await getAllTreatments();

  return <TreatmentsUI treatments={treatments} groups={groups} />;
}
