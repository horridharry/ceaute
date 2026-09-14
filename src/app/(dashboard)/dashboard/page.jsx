import DashboardOverview from "./_components/dashboard-overview";
import { getSignedInProvider } from "./_lib/provider-data";

export default async function DashboardOverviewPage() {
  const { user, providerPage } = await getSignedInProvider();

  return (
    <DashboardOverview user={user} providerPage={providerPage} />
  );
}
