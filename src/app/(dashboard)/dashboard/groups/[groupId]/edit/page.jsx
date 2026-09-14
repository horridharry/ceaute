import { redirect } from "next/navigation";
import { TreatmentGroupForm } from "../../_components/treatment-group-form";
import {
  getTreatmentGroups,
  renameTreatmentGroup,
} from "../../../treatments/actions";

export default async function EditTreatmentGroupPage({ params }) {
  const { groupId } = await params;
  const groups = await getTreatmentGroups({
    next: `/dashboard/groups/${groupId}/edit`,
  });
  const group = groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    redirect("/dashboard/groups");
  }

  return <TreatmentGroupForm action={renameTreatmentGroup} group={group} />;
}
