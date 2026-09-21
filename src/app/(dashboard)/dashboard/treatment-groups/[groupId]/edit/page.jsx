import { redirect } from "next/navigation";
import { TreatmentGroupForm } from "../../_components/treatment-group-form";
import { renameTreatmentGroup } from "../../actions";
import { getTreatmentGroups } from "../../queries";

export default async function EditTreatmentGroupPage({ params }) {
  const { groupId } = await params;
  const groups = await getTreatmentGroups({
    next: `/dashboard/treatment-groups/${groupId}/edit`,
  });
  const group = groups.find((candidate) => candidate.id === groupId);

  if (!group) {
    redirect("/dashboard/treatment-groups");
  }

  return <TreatmentGroupForm action={renameTreatmentGroup} group={group} />;
}
