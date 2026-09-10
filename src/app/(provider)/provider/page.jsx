import ProviderHome from "./_components/provider-home";
import {
  getSignedInProvider,
  providerPageToProviderProfile,
} from "./_lib/provider-data";

export default async function ProviderHomePage() {
  const { user, providerPage } = await getSignedInProvider();

  return (
    <ProviderHome
      user={user}
      profile={providerPageToProviderProfile(providerPage)}
    />
  );
}
