import { TreatmentAddOnForm } from "../../../_components/treatment-add-on-form";
import {
  archiveTreatmentAddOn,
  getTreatmentAddOn,
  getTreatmentAddOnOptions,
  restoreTreatmentAddOn,
  updateTreatmentAddOn,
} from "../../../actions";

export default async function Page({ params }) {
  const { addonId } = await params;
  const [addOn, options] = await Promise.all([
    getTreatmentAddOn(addonId),
    getTreatmentAddOnOptions({
      next: `/provider/treatments/add-ons/update/${addonId}`,
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
