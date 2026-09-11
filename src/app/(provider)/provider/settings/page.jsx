import { getSignedInProvider } from "../_lib/provider-data";
import Link from "next/link";

export default async function ProviderSettingsPage() {
  await getSignedInProvider({ next: "/provider/settings" });

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
        <div className="mt-12 flex flex-col gap-3">
          <Link
            href="/provider/settings/booking"
            className="block rounded-xl border p-3 text-sm font-semibold duration-200 hover:border-black/20 hover:bg-black/5"
          >
            Booking settings
          </Link>
          <Link
            href="/provider/settings/payments"
            className="block rounded-xl border p-3 text-sm font-semibold duration-200 hover:border-black/20 hover:bg-black/5"
          >
            Payments
          </Link>
        </div>
      </div>
    </main>
  );
}

