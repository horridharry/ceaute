import { TreatmentGroupsPage } from "../_components/treatment-groups-page";
import {
  archiveTreatmentGroup,
  createTreatmentGroup,
  getTreatmentGroups,
  renameTreatmentGroup,
  restoreTreatmentGroup,
} from "../actions";

export default async function Page() {
  const groups = await getTreatmentGroups();

  return (
    <TreatmentGroupsPage
      groups={groups}
      createAction={createTreatmentGroup}
      renameAction={renameTreatmentGroup}
      archiveAction={archiveTreatmentGroup}
      restoreAction={restoreTreatmentGroup}
    />
  );
}
