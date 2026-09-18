import { notFound } from "next/navigation";
import Form from "next/form";
import { FormTemplate } from "@/components/templates/form-template";
import { AddOnList, AddOnRow } from "@/components/ui/add-on-row";
import { CommitBar } from "@/components/ui/commit-bar";
import { SubmitButton } from "@/components/ui/submit-button";
import { StackedTopBar } from "@/components/ui/top-bar";
import { getPublicBookingPage } from "../../_lib/public-provider-data";
import {
  formatDurationMinutes,
  formatPricePence,
  hasPublicUsernamePrefix,
  normalizePublicUsername,
} from "../../_lib/public-provider-format";

function normalizeAddOnSearch(searchParams) {
  const addOns = searchParams?.add_on;
  const addOnIds = Array.isArray(addOns) ? addOns : [addOns];

  return addOnIds.filter(Boolean).map((addOnId) => String(addOnId));
}

// The add-ons step as its own route. Most customers meet add-ons in the
// treatment modal on the provider page; this is where "Change add-ons" from
// the time picker lands, and it is the no-JavaScript path to the same URL.
// It stays a plain GET form, so the selection travels in the query string
// exactly as the modal's link does.
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
  const selectedAddOnIdSet = new Set(selectedAddOns.map((addOn) => addOn.id));

  return (
    <FormTemplate
      as={Form}
      action={`/@${providerPage.username}/book/${treatment.id}/time`}
      nav={
        <StackedTopBar
          backHref={`/@${providerPage.username}/treatments`}
          backLabel="Treatments"
        />
      }
      commitBar={
        <CommitBar
          contextLabel={formatPricePence(treatment.price_pence)}
          contextDetail={formatDurationMinutes(treatment.duration_minutes)}
        >
          <SubmitButton
            block={false}
            pendingLabel="Continuing"
            className="px-6"
          >
            Pick a time
          </SubmitButton>
        </CommitBar>
      }
    >
      <header className="flex flex-col gap-1">
        <h1 className="text-display text-pretty text-ink">{treatment.name}</h1>
        <p className="text-meta text-black/50">
          {formatDurationMinutes(treatment.duration_minutes)} ·{" "}
          {formatPricePence(treatment.price_pence)}
        </p>
      </header>

      {treatment.description ? (
        <p className="whitespace-pre-line text-body text-black/80">
          {treatment.description}
        </p>
      ) : null}

      {compatibleAddOns.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-label uppercase text-black/45">
            Add-ons · optional
          </p>
          <AddOnList>
            {compatibleAddOns.map((addOn) => (
              <AddOnRow
                key={addOn.id}
                name={addOn.name}
                value={addOn.id}
                defaultChecked={selectedAddOnIdSet.has(addOn.id)}
                delta={[
                  `+ ${formatPricePence(addOn.additional_price_pence)}`,
                  addOn.additional_duration_minutes
                    ? `+ ${formatDurationMinutes(addOn.additional_duration_minutes)}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            ))}
          </AddOnList>
        </div>
      ) : null}
    </FormTemplate>
  );
}
