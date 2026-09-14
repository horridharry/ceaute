import { TreatmentGroupsPage } from "./_components/treatment-groups-page";
import {
  archiveTreatmentGroup,
  getTreatmentGroups,
  restoreTreatmentGroup,
} from "./actions";

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
