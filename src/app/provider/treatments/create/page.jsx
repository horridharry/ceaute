import { CreateTreatmentUI } from "./components/create-treatment-ui";
import { getSignedInProvider } from "../../lib/provider-data";

export default async function Page() {
  const { user } = await getSignedInProvider({
    next: "/provider/treatments/create",
  });

  return <CreateTreatmentUI userId={user.id} />;
}
