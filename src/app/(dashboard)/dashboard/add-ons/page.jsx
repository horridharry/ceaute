import { TreatmentAddOnsPage } from "./_components/treatment-add-ons-page";
import { getCatalogueCounts } from "../_lib/catalogue-counts";
import { getAllAddOns } from "./actions";

export default async function AddOnsPage() {
  const [addOns, counts] = await Promise.all([
    getAllAddOns(),
    getCatalogueCounts("/dashboard/add-ons"),
  ]);

  return <TreatmentAddOnsPage addOns={addOns} counts={counts} />;
}
