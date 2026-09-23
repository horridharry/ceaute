import { DashboardPage } from "../../_components/dashboard-page";
import { publishPage, unpublishPage } from "./actions";
import { PublicationPanel } from "./_components/publication-panel";
import { getPublicationStatus } from "./queries";

export default async function PublicationPage() {
  const { status, username, readiness } = await getPublicationStatus();

  return (
    <DashboardPage title="Publication" description="Choose when customers can find and book you.">
      <PublicationPanel
        status={status}
        username={username}
        readiness={readiness}
        publishPage={publishPage}
        unpublishPage={unpublishPage}
      />
    </DashboardPage>
  );
}
