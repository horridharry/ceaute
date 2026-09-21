import { TreatmentGroupsPage } from "./_components/treatment-groups-page";
import { archiveTreatmentGroup, restoreTreatmentGroup } from "./actions";
import { getTreatmentGroups } from "./queries";

export default async function TreatmentGroupsPageRoute() {
  const groups = await getTreatmentGroups();

  return (
    <TreatmentGroupsPage
      groups={groups}
      archiveAction={archiveTreatmentGroup}
      restoreAction={restoreTreatmentGroup}
    />
  );
}
