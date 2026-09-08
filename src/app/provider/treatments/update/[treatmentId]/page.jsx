import { getTreatment } from "../../actions";
import { getSignedInProvider } from "../../../lib/provider-data";

import { UpdateTreatmentUI } from "./components/update-treatment-ui";

export default async function Page({ params }) {
  const { treatmentId } = await params;
  const { user } = await getSignedInProvider({
    next: `/provider/treatments/update/${treatmentId}`,
  });

  const treatment = await getTreatment(treatmentId);

  const formattedTreatment = {
    ...treatment,
    hour: parseInt(treatment.duration.split(":")[1]),
    minute: parseInt(treatment.duration.split(":")[2]),
    duration:
      parseInt(treatment.duration.split(":")[1]) * 60 +
      parseInt(treatment.duration.split(":")[2]),
  };

  return <UpdateTreatmentUI treatment={formattedTreatment} userId={user.id} />;
}
