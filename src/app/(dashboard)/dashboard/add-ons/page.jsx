import { TreatmentAddOnsPage } from "./_components/treatment-add-ons-page";
import { getAllTreatmentAddOns } from "../treatments/actions";

export default async function AddOnsPage() {
  const addOns = await getAllTreatmentAddOns();

  return <TreatmentAddOnsPage addOns={addOns} />;
}
