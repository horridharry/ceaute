import { TreatmentAddOnForm } from "../_components/treatment-add-on-form";
import {
  createTreatmentAddOn,
  getTreatmentAddOnOptions,
} from "../../treatments/actions";

export default async function NewAddOnPage() {
  const { treatments } = await getTreatmentAddOnOptions({
    next: "/dashboard/add-ons/new",
  });

  return (
    <TreatmentAddOnForm
      action={createTreatmentAddOn}
      mode="create"
      treatments={treatments}
    />
  );
}
