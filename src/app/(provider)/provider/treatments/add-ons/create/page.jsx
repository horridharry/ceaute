import { TreatmentAddOnForm } from "../../_components/treatment-add-on-form";
import { createTreatmentAddOn, getTreatmentAddOnOptions } from "../../actions";

export default async function Page() {
  const { treatments } = await getTreatmentAddOnOptions({
    next: "/provider/treatments/add-ons/create",
  });

  return (
    <TreatmentAddOnForm
      action={createTreatmentAddOn}
      mode="create"
      treatments={treatments}
    />
  );
}
