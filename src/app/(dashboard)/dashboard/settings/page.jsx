import { getSignedInProvider } from "../_lib/provider-data";
import { SettingsRow } from "../_components/settings-row";

export default async function DashboardSettingsPage() {
  await getSignedInProvider({ next: "/dashboard/settings" });

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
        <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
          <SettingsRow href="/account/settings">Account</SettingsRow>
          <SettingsRow href="/dashboard/settings/booking">
            Booking settings
          </SettingsRow>
          <SettingsRow href="/dashboard/settings/payments">
            Payments
          </SettingsRow>
        </div>
      </div>
    </main>
  );
}
