import { getAllTreatments } from "./actions";
import { getCatalogueCounts } from "../_lib/catalogue-counts";
import { TreatmentsUI } from "./_components/treatments-page";

export default async function TreatmentsPage() {
  const [allTreatments, counts] = await Promise.all([
    getAllTreatments(),
    getCatalogueCounts("/dashboard/treatments"),
  ]);

  return <TreatmentsUI treatments={allTreatments} counts={counts} />;
}
