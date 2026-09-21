import { redirect } from "next/navigation";
import { LocationFormUI } from "../../_components/location-form-ui";
import { updateLocation } from "../../actions";
import { getLocation } from "../../queries";

export default async function EditLocationPage({ params }) {
  const { locationId } = await params;
  const location = await getLocation(locationId);

  if (!location) {
    redirect("/dashboard/locations");
  }

  return <LocationFormUI action={updateLocation} location={location} />;
}
