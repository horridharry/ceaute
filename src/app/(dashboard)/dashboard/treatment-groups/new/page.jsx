import { TreatmentGroupForm } from "../_components/treatment-group-form";
import { createTreatmentGroup } from "../actions";

export default function NewTreatmentGroupPage() {
  return <TreatmentGroupForm action={createTreatmentGroup} />;
}
