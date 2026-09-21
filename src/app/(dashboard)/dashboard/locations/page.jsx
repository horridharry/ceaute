import { LocationsPage } from "./_components/locations-page";
import { deleteLocation, makeLocationPrimary } from "./actions";
import { getLocations } from "./queries";

export default async function DashboardLocationsPage() {
  const locations = await getLocations();

  return (
    <LocationsPage
      locations={locations}
      makePrimaryAction={makeLocationPrimary}
      deleteAction={deleteLocation}
    />
  );
}
