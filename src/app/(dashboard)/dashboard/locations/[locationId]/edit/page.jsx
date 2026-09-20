import { redirect } from "next/navigation";
import { LocationFormUI } from "../../_components/location-form-ui";
import { getLocation, updateLocation } from "../../actions";

export default async function EditLocationPage({ params }) {
  const { locationId } = await params;
  const location = await getLocation(locationId);

  if (!location) {
    redirect("/dashboard/locations");
  }

  return <LocationFormUI action={updateLocation} location={location} />;
}
