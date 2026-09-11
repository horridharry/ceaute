import {
  formatDurationMinutes,
  formatPricePence,
} from "../_lib/public-provider-format";

function EmptyState({ children }) {
  return (
    <div className="rounded-xl border border-dashed p-4 text-sm text-black/60">
      {children}
    </div>
  );
}

function PaymentTerms({ terms }) {
  const commitment = Number.isInteger(terms.commitment_amount_pence)
    ? formatPricePence(terms.commitment_amount_pence)
    : null;
  const paymentText =
    terms.payment_mode === "fixed_deposit"
      ? `${commitment ?? "A fixed deposit"} is paid when booking and retained after late cancellation.`
      : `Customers pay in full when booking. ${commitment ?? "The commitment amount"} is retained after late cancellation and the rest is refunded.`;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Booking terms</h2>
      <div className="rounded-xl border p-4 text-sm">
        <p>{paymentText}</p>
        <p className="mt-2 text-black/60">
          Cancellation window:{" "}
          {terms.cancellation_window_hours
            ? `${terms.cancellation_window_hours} hours`
            : "Not set yet"}
        </p>
        {terms.written_policy ? (
          <p className="mt-4 whitespace-pre-wrap">{terms.written_policy}</p>
        ) : (
          <p className="mt-4 text-black/60">No written policies added yet.</p>
        )}
      </div>
    </section>
  );
}

function TreatmentAddOns({ addOns }) {
  if (addOns.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t pt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-black/50">
        Compatible add-ons
      </p>
      <ul className="mt-2 flex flex-col gap-2">
        {addOns.map((addOn) => (
          <li key={addOn.name} className="text-sm">
            <span className="font-medium">{addOn.name}</span>
            <span className="text-black/60">
              {" "}
              +{formatPricePence(addOn.additional_price_pence)} · +
              {formatDurationMinutes(addOn.additional_duration_minutes)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TreatmentSections({ sections }) {
  if (sections.length === 0) {
    return <EmptyState>No active treatments are visible yet.</EmptyState>;
  }

  return (
    <div className="flex flex-col gap-6">
      {sections.map((section) => (
        <section key={section.name ?? "ungrouped"} className="flex flex-col gap-3">
          {section.name ? (
            <h2 className="text-lg font-semibold">{section.name}</h2>
          ) : null}
          {section.treatments.map((treatment) => (
            <article key={treatment.name} className="rounded-xl border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{treatment.name}</h3>
                  {treatment.description ? (
                    <p className="mt-1 text-sm text-black/60">
                      {treatment.description}
                    </p>
                  ) : null}
                </div>
                <div className="shrink-0 text-right text-sm font-medium">
                  <p>{formatPricePence(treatment.price_pence)}</p>
                  <p className="text-black/60">
                    {formatDurationMinutes(treatment.duration_minutes)}
                  </p>
                </div>
              </div>
              <TreatmentAddOns addOns={treatment.add_ons} />
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}

export function StorefrontPage({ viewModel, backHref }) {
  const { provider, portfolio, treatment_sections: treatmentSections } =
    viewModel;

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col gap-10">
        <header>
          {backHref ? (
            <a
              href={backHref}
              className="mb-8 inline-flex text-sm font-semibold text-pink-600"
            >
              Back to page settings
            </a>
          ) : null}
          <h1 className="text-3xl font-bold tracking-tighter">
            {provider.business_name || "Untitled provider page"}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2 text-sm text-black/60">
            {provider.username ? <p>/@{provider.username}</p> : null}
            {provider.provider_category ? <p>{provider.provider_category}</p> : null}
            {provider.public_area ? <p>{provider.public_area}</p> : null}
          </div>
          {provider.biography ? (
            <p className="mt-5 whitespace-pre-wrap text-sm">
              {provider.biography}
            </p>
          ) : (
            <p className="mt-5 text-sm text-black/60">
              Biography has not been added yet.
            </p>
          )}
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          {portfolio.length ? (
            <div className="grid grid-cols-2 gap-3">
              {portfolio.map((image, index) => (
                <figure key={`${image.image_url}-${index}`} className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element -- Portfolio previews use short-lived signed storage URLs. */}
                  <img
                    src={image.image_url}
                    alt={image.caption || "Portfolio image"}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  {image.caption ? (
                    <figcaption className="mt-1 truncate text-xs text-black/60">
                      {image.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <EmptyState>No visible portfolio images yet.</EmptyState>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Treatments</h2>
          <TreatmentSections sections={treatmentSections} />
        </section>

        <PaymentTerms terms={viewModel.booking_terms} />
      </div>
    </main>
  );
}
