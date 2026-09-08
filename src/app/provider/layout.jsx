import { DashboardNav } from "./components/dashboard-nav";

export default async function DashboardLayout({ children }) {
  return (
    <div>
      <DashboardNav />
      {children}
    </div>
  );
}
