import { TreatmentForm } from "../../_components/treatment-form";
import {
  archiveTreatment,
  getTreatment,
  getTreatmentFormOptions,
  restoreTreatment,
  updateTreatment,
} from "../../actions";

export default async function Page({ params }) {
  const { treatmentId } = await params;
  const [treatment, options] = await Promise.all([
    getTreatment(treatmentId),
    getTreatmentFormOptions({
      next: `/provider/treatments/update/${treatmentId}`,
    }),
  ]);

  return (
    <TreatmentForm
      action={updateTreatment}
      archiveAction={archiveTreatment}
      restoreAction={restoreTreatment}
      discoveryCategories={options.discoveryCategories}
      treatmentGroups={options.treatmentGroups}
      mode="edit"
      treatment={treatment}
    />
  );
}
