import { getSignedInProvider } from "../_lib/provider-data";
import Link from "next/link";

export default async function DashboardSettingsPage() {
  await getSignedInProvider({ next: "/dashboard/settings" });

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Settings</h1>
        <div className="mt-8 divide-y divide-black/10 border-y border-black/10">
          <Link
            href="/account/settings"
            className="flex items-center justify-between gap-4 py-4 text-sm font-medium hover:text-pink-600"
          >
            <span>Account</span>
            <span aria-hidden="true" className="text-black/35">›</span>
          </Link>
          <Link
            href="/dashboard/settings/booking"
            className="flex items-center justify-between gap-4 py-4 text-sm font-medium hover:text-pink-600"
          >
            <span>Booking settings</span>
            <span aria-hidden="true" className="text-black/35">›</span>
          </Link>
          <Link
            href="/dashboard/settings/payments"
            className="flex items-center justify-between gap-4 py-4 text-sm font-medium hover:text-pink-600"
          >
            <span>Payments</span>
            <span aria-hidden="true" className="text-black/35">›</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
