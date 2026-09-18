import AppHeader from "@/components/app-header/app-header";
import { PAGE_COLUMN } from "@/components/templates/page-column";
import { DashboardNav } from "./_components/dashboard-nav";

export default async function DashboardLayout({ children }) {
  return (
    <>
      <AppHeader />
      <div className={PAGE_COLUMN}>
        <DashboardNav />
      </div>
      {children}
    </>
  );
}
