import { ListTemplate } from "@/components/templates/list-template";
import { SettingRow } from "@/components/ui/setting-row";
import { getSignedInProvider } from "../_lib/provider-data";

// B7 leaves Settings with the two things that belong to it: what customers pay
// and how she gets paid. Location and working hours moved under Page, groups
// and add-ons under Treatments.
export default async function DashboardSettingsPage() {
  await getSignedInProvider({ next: "/dashboard/settings" });

  return (
    <ListTemplate title="Settings">
      <SettingRow
        title="Booking terms"
        value="Deposit or full payment, and the cancellation window."
        href="/dashboard/settings/booking"
      />
      <SettingRow
        title="Payments"
        value="Your Stripe account and what it still needs."
        href="/dashboard/settings/payments"
      />
    </ListTemplate>
  );
}
