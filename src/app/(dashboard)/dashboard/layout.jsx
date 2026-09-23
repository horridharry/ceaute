import { unstable_rethrow } from "next/navigation";
import AppHeader from "@/components/app-header/app-header";
import { UnsavedChangesProvider } from "@/components/unsaved-changes/unsaved-changes-provider";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";
import { FocusedTaskHeaderGate } from "./_components/focused-task-header-gate";
import { SetupGuide } from "./_components/setup-guide";
import { getSetupState } from "./_lib/publication-checks";

// The setup state for the guide. It must never take the dashboard down: if
// it cannot be read the guide simply is not shown, and Publication still
// works (it reads the same breakdown itself).
async function loadSetup() {
  try {
    const { supabase, claims } = await getRequestSession();
    const userId = claims?.sub;

    if (!userId) {
      return null;
    }

    const providerPage = await getOwnedProviderPage(userId);

    if (!providerPage || providerPage.status !== "draft") {
      return null;
    }

    return await getSetupState({ supabase, providerPage });
  } catch (error) {
    // Next's own signals (dynamic rendering, redirects) are not failures.
    unstable_rethrow(error);
    console.error("Setup guide unavailable", error);
    return null;
  }
}

// UnsavedChangesProvider wraps the header too, so its menu links are covered
// when a screen registers unsaved changes. It does nothing until one does.
export default async function DashboardLayout({ children }) {
  const setup = await loadSetup();

  return (
    <UnsavedChangesProvider>
      <FocusedTaskHeaderGate>
        <AppHeader />
      </FocusedTaskHeaderGate>
      {children}
      <SetupGuide setup={setup} />
    </UnsavedChangesProvider>
  );
}
