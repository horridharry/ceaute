import { getAllTreatments } from "./queries";
import { TreatmentsUI } from "./_components/treatments-page";

export default async function TreatmentsPage() {
  const allTreatments = await getAllTreatments();

  return <TreatmentsUI treatments={allTreatments} />;
}
