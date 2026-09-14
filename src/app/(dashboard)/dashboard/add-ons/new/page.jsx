import { TreatmentAddOnForm } from "../_components/treatment-add-on-form";
import {
  createAddOnWithCompatibility,
  getAddOnFormOptions,
} from "../actions";

export default async function NewAddOnPage() {
  const { treatments } = await getAddOnFormOptions({
    next: "/dashboard/add-ons/new",
  });

  return (
    <TreatmentAddOnForm
      action={createAddOnWithCompatibility}
      mode="create"
      treatments={treatments}
    />
  );
}
