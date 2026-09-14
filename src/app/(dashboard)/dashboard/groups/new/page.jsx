import { TreatmentGroupForm } from "../_components/treatment-group-form";
import { createTreatmentGroup } from "../../treatments/actions";

export default function NewTreatmentGroupPage() {
  return <TreatmentGroupForm action={createTreatmentGroup} />;
}
