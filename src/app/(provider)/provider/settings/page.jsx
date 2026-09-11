import { getSignedInProvider } from "../_lib/provider-data";

export default async function ProviderSettingsPage() {
  await getSignedInProvider({ next: "/provider/settings" });

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
        <p className="mt-1 text-sm">
          Providers will manage active location, payment settings, booking rules
          and policies here.
        </p>
      </div>
    </main>
  );
}

