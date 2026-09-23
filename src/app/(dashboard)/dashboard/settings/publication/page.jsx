import { DashboardPage } from "../../_components/dashboard-page";
import { publishPage, unpublishPage } from "./actions";
import { PublicationPanel } from "./_components/publication-panel";
import { getPublicationStatus } from "./queries";

export default async function PublicationPage() {
  const { status, username, setup } = await getPublicationStatus();

  return (
    <DashboardPage title="Publication" description="Choose when customers can find and book you.">
      <PublicationPanel
        status={status}
        username={username}
        setup={setup}
        publishPage={publishPage}
        unpublishPage={unpublishPage}
      />
    </DashboardPage>
  );
}
