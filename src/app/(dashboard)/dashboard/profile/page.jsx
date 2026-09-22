import { DashboardPage } from "../_components/dashboard-page";
import { getProviderPage } from "./queries";
import { removeDisplayPhoto, updateProviderPage, uploadDisplayPhoto } from "./actions";
import { DisplayPhotoForm } from "./_components/display-photo-form";
import { ProviderPageForm } from "./_components/provider-page-form";

// Who the provider is: display photo, business name, username, category and
// biography. Whether the page is live, and Preview, are in Settings →
// Publication; photos of their work are in Portfolio.
export default async function DashboardProfilePage() {
  const { providerPage, displayPhotoUrl } = await getProviderPage();

  return (
    <DashboardPage title="Profile">
      <DisplayPhotoForm
        photoUrl={displayPhotoUrl}
        uploadDisplayPhoto={uploadDisplayPhoto}
        removeDisplayPhoto={removeDisplayPhoto}
      />
      <ProviderPageForm providerPage={providerPage} updateProviderPage={updateProviderPage} />
    </DashboardPage>
  );
}
