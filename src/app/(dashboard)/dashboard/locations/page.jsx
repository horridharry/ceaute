import { LocationsPage } from "./_components/locations-page";
import { deleteLocation, getLocations, makeLocationPrimary } from "./actions";

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
