import { DashboardNav } from "./_components/dashboard-nav";

export default async function DashboardLayout({ children }) {
  return (
    <div>
      <DashboardNav />
      {children}
    </div>
  );
}
