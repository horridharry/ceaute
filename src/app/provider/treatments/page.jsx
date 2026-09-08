import { getAllTreatments } from "./actions";
import { TreatmentsUI } from "./components/treatments-page";

export default async function TreatmentsPage() {
  const allTreatments = await getAllTreatments();

  return <TreatmentsUI clientTreatments={allTreatments} />;
}
