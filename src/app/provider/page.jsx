import DashboardUI from "./components/dashboard-ui";
import {
  getSignedInProvider,
  providerPageToDashboardProfile,
} from "./lib/provider-data";

export default async function Dashboard() {
  const { user, providerPage } = await getSignedInProvider();

  return (
    <DashboardUI
      user={user}
      profile={providerPageToDashboardProfile(providerPage)}
    />
  );
}
