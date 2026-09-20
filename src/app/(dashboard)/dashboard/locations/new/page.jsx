import { LocationFormUI } from "../_components/location-form-ui";
import { createLocation } from "../actions";

export default function NewLocationPage() {
  return <LocationFormUI action={createLocation} />;
}
