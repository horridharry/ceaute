// Parameters for creating a provider's Stripe recipient account. The mapping
// lives outside the Server Action so it can be tested: the provider page row
// exposes `display_name`, and the account's display name must come from it.
export function buildRecipientAccountParams({ providerPage, contactEmail }) {
  const displayName = String(providerPage?.display_name ?? "").trim();

  return {
    contact_email: contactEmail || undefined,
    display_name: displayName || undefined,
    dashboard: "express",
    identity: {
      country: "GB",
    },
    configuration: {
      recipient: {
        capabilities: {
          stripe_balance: {
            stripe_transfers: {
              requested: true,
            },
          },
        },
      },
    },
    defaults: {
      currency: "gbp",
      locales: ["en-GB"],
      profile: {
        product_description: "Beauty appointment services booked through Ceaute.",
      },
      responsibilities: {
        fees_collector: "application",
        losses_collector: "application",
      },
    },
    include: ["configuration.recipient", "identity", "requirements"],
    metadata: {
      provider_page_id: providerPage.id,
    },
  };
}
