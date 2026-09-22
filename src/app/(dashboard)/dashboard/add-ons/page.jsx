import { lifecycleStatus } from "../_lib/lifecycle-lists";
import { TreatmentAddOnsPage } from "./_components/treatment-add-ons-page";
import { transitionAddOn } from "./actions";
import { getAllAddOns } from "./queries";

export default async function AddOnsPage({ searchParams }) {
  const params = await searchParams;
  const status = lifecycleStatus(Array.isArray(params?.status) ? params.status[0] : params?.status);
  const addOns = await getAllAddOns();

  return <TreatmentAddOnsPage addOns={addOns} status={status} transitionAction={transitionAddOn} />;
}
