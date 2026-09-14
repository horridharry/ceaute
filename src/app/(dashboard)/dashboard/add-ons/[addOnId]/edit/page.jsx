import { TreatmentAddOnForm } from "../../_components/treatment-add-on-form";
import {
  archiveTreatmentAddOn,
  getTreatmentAddOn,
  getTreatmentAddOnOptions,
  restoreTreatmentAddOn,
  updateTreatmentAddOn,
} from "../../../treatments/actions";

export default async function EditAddOnPage({ params }) {
  const { addOnId } = await params;
  const [addOn, options] = await Promise.all([
    getTreatmentAddOn(addOnId),
    getTreatmentAddOnOptions({
      next: `/dashboard/add-ons/${addOnId}/edit`,
    }),
  ]);

  return (
    <TreatmentAddOnForm
      action={updateTreatmentAddOn}
      archiveAction={archiveTreatmentAddOn}
      restoreAction={restoreTreatmentAddOn}
      addOn={addOn}
      mode="edit"
      treatments={options.treatments}
    />
  );
}
