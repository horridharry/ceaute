import AppHeader from "@/components/app-header/app-header";
import { FocusedTaskHeaderGate } from "./_components/focused-task-header-gate";

export default async function DashboardLayout({ children }) {
  return (
    <>
      <FocusedTaskHeaderGate>
        <AppHeader />
      </FocusedTaskHeaderGate>
      {children}
    </>
  );
}
