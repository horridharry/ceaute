import { TreatmentForm } from "../_components/treatment-form";
import { createTreatment, getTreatmentFormOptions } from "../actions";

export default async function Page() {
  const { discoveryCategories, treatmentGroups } =
    await getTreatmentFormOptions({ next: "/provider/treatments/create" });

  return (
    <TreatmentForm
      action={createTreatment}
      discoveryCategories={discoveryCategories}
      treatmentGroups={treatmentGroups}
      mode="create"
    />
  );
}
