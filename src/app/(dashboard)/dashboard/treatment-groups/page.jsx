import { TreatmentGroupsPage } from "./_components/treatment-groups-page";
import { getCatalogueCounts } from "../_lib/catalogue-counts";
import {
  archiveTreatmentGroup,
  getTreatmentGroups,
  restoreTreatmentGroup,
} from "./actions";

export default async function TreatmentGroupsPageRoute() {
  const [groups, counts] = await Promise.all([
    getTreatmentGroups(),
    getCatalogueCounts("/dashboard/treatment-groups"),
  ]);

  return (
    <TreatmentGroupsPage
      groups={groups}
      counts={counts}
      archiveAction={archiveTreatmentGroup}
      restoreAction={restoreTreatmentGroup}
    />
  );
}
