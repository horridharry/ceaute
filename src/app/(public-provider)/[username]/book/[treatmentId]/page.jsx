import { notFound } from "next/navigation";
import Form from "next/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Notice } from "@/components/ui/notice";
import { PageContainer } from "@/components/ui/page-container";
import { PageHeading } from "@/components/ui/page-heading";
import { PendingButton } from "@/components/ui/pending-button";
import { BookingTreatmentSummary } from "../_components/booking-treatment-summary";
import {
  getProviderAcceptsBookings,
  getPublicBookingPage,
} from "../../_lib/public-provider-data";
import {
  formatDurationMinutes,
  formatPricePence,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "@/features/storefront/format";
import { normalizeAddOnSearch } from "@/features/storefront/add-on-search";

// Add-ons for a treatment without JavaScript, and the time page's "Change
// add-ons". The storefront's details sheet makes the same choice in place.
export default async function TreatmentBookingPage({ params, searchParams }) {
  const { username, treatmentId } = await params;
  const resolvedSearchParams = await searchParams;

  if (!hasPublicUsernamePrefix(username)) {
    notFound();
  }

  const decodedUsername = normalizePublicUsername(username);
  const selectedAddOnIds = normalizeAddOnSearch(resolvedSearchParams);
  const { providerPage, treatment, compatibleAddOns, selectedAddOns } =
    await getPublicBookingPage(decodedUsername, treatmentId, selectedAddOnIds);
  const takingBookings = await getProviderAcceptsBookings(providerPage.id);
  const selectedAddOnIdSet = new Set(selectedAddOns.map((addOn) => addOn.id));
  const providerName = providerPage.display_name || `@${providerPage.username}`;

  return (
    <PageContainer>
      <PageHeading back={{ href: `/@${providerPage.username}`, label: providerName }} title="Choose add-ons" />

      <div className="mt-6">
        <BookingTreatmentSummary treatment={treatment} />
      </div>

      {takingBookings ? (
        <Form action={`/@${providerPage.username}/book/${treatment.id}/time`} className="mt-8">
          <fieldset>
            <legend className="text-lg font-semibold tracking-tight">Add-ons</legend>
            {compatibleAddOns.length ? (
              <ul className="mt-3 flex flex-col">
                {compatibleAddOns.map((addOn) => (
                  <li key={addOn.id} className="border-b border-line last:border-b-0">
                    <label htmlFor={`add_on_${addOn.id}`} className="flex min-h-13 cursor-pointer items-center gap-3 py-2 text-sm">
                      <Checkbox
                        id={`add_on_${addOn.id}`}
                        name="add_on"
                        value={addOn.id}
                        defaultChecked={selectedAddOnIdSet.has(addOn.id)}
                      />
                      <span className="flex-1">{addOn.name}</span>
                      <span className="text-ink-muted tabular-nums">
                        +{formatPricePence(addOn.additional_price_pence)} · +
                        {formatDurationMinutes(addOn.additional_duration_minutes)}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-ink-muted">No add-ons are available for this treatment.</p>
            )}
          </fieldset>
          <div className="mt-6">
            <PendingButton pendingLabel="Continuing…">Choose a time</PendingButton>
          </div>
        </Form>
      ) : (
        <Notice tone="neutral" className="mt-6">
          {providerName} isn’t taking online bookings right now.
        </Notice>
      )}
    </PageContainer>
  );
}
