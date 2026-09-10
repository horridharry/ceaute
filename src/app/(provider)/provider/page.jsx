import DashboardUI from "./_components/dashboard-ui";
import {
  getSignedInProvider,
  providerPageToDashboardProfile,
} from "./_lib/provider-data";

export default async function Dashboard() {
  const { user, providerPage } = await getSignedInProvider();

  return (
    <DashboardUI
      user={user}
      profile={providerPageToDashboardProfile(providerPage)}
    />
  );
}
