import { TreatmentAddOnsPage } from "./_components/treatment-add-ons-page";
import { getAllAddOns } from "./actions";

export default async function AddOnsPage() {
  const addOns = await getAllAddOns();

  return <TreatmentAddOnsPage addOns={addOns} />;
}
