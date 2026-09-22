import { lifecycleStatus } from "../_lib/lifecycle-lists";
import { TreatmentGroupsPage } from "./_components/treatment-groups-page";
import { transitionTreatmentGroup } from "./actions";
import { getTreatmentGroups } from "./queries";

export default async function TreatmentGroupsPageRoute({ searchParams }) {
  const params = await searchParams;
  const status = lifecycleStatus(Array.isArray(params?.status) ? params.status[0] : params?.status);
  const groups = await getTreatmentGroups();

  return (
    <TreatmentGroupsPage
      groups={groups}
      status={status}
      transitionAction={transitionTreatmentGroup}
    />
  );
}
