import { getLocation, updateLocation } from "./actions";
import { LocationFormUI } from "./_components/location-form-ui";

export default async function DashboardLocationsPage() {
  const location = await getLocation();

  return <LocationFormUI location={location} updateLocation={updateLocation} />;
}
