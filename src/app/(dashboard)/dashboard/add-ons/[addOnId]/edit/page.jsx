import { TreatmentAddOnForm } from "../../_components/treatment-add-on-form";
import {
  archiveAddOn,
  getAddOn,
  getAddOnFormOptions,
  restoreAddOn,
  updateAddOnWithCompatibility,
} from "../../actions";

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
      archiveAction={archiveAddOn}
      restoreAction={restoreAddOn}
      addOn={addOn}
      mode="edit"
      treatments={options.treatments}
    />
  );
}
