import { TreatmentAddOnsPage } from "../_components/treatment-add-ons-page";
import { getAllTreatmentAddOns } from "../actions";

export default async function Page() {
  const addOns = await getAllTreatmentAddOns();

  return <TreatmentAddOnsPage addOns={addOns} />;
}
