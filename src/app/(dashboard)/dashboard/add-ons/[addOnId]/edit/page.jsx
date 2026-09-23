import { TreatmentAddOnForm } from "../../_components/treatment-add-on-form";
import { updateAddOnWithCompatibility } from "../../actions";
import { getAddOn, getAddOnFormOptions } from "../../queries";

export default async function EditAddOnPage({ params }) {
  const { addOnId } = await params;
  const [addOn, options] = await Promise.all([
    getAddOn(addOnId),
    getAddOnFormOptions({
      next: `/dashboard/add-ons/${addOnId}/edit`,
    }),
  ]);

  return (
    <TreatmentAddOnForm
      action={updateAddOnWithCompatibility}
      addOn={addOn}
      mode="edit"
      treatments={options.treatments}
    />
  );
}
