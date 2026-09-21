import AppHeader from "@/components/app-header/app-header";
import { UnsavedChangesProvider } from "@/components/unsaved-changes/unsaved-changes-provider";
import { FocusedTaskHeaderGate } from "./_components/focused-task-header-gate";

// UnsavedChangesProvider wraps the header too, so its menu links are covered
// when a screen registers unsaved changes. It does nothing until one does.
export default async function DashboardLayout({ children }) {
  return (
    <UnsavedChangesProvider>
      <FocusedTaskHeaderGate>
        <AppHeader />
      </FocusedTaskHeaderGate>
      {children}
    </UnsavedChangesProvider>
  );
}
