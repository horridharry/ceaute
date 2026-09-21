import { TreatmentForm } from "../_components/treatment-form";
import { createTreatment } from "../actions";
import { getTreatmentFormOptions } from "../queries";

export default async function NewTreatmentPage() {
  const { discoveryCategories, treatmentGroups } =
    await getTreatmentFormOptions({ next: "/dashboard/treatments/new" });

  return (
    <TreatmentForm
      action={createTreatment}
      discoveryCategories={discoveryCategories}
      treatmentGroups={treatmentGroups}
      mode="create"
    />
  );
}
