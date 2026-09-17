import assert from "node:assert/strict";
import test from "node:test";
import { buildRecipientAccountParams } from "../src/lib/stripe/recipient-account.js";

// The signed-in provider page is the raw provider_page row, whose business
// name column is display_name. A previous version read a form-values field
// that does not exist on the row, so every Stripe account was created with an
// undefined display name.
test("the Stripe account display name comes from provider_page.display_name", () => {
  const params = buildRecipientAccountParams({
    providerPage: { id: "page-1", display_name: "  Glow Studio  " },
    contactEmail: "owner@example.test",
  });

  assert.equal(params.display_name, "Glow Studio");
  assert.equal(params.contact_email, "owner@example.test");
  assert.equal(params.metadata.provider_page_id, "page-1");
  assert.equal(params.dashboard, "express");
  assert.equal(params.identity.country, "GB");
  assert.equal(
    params.configuration.recipient.capabilities.stripe_balance.stripe_transfers.requested,
    true,
  );
});

test("a page without a display name or email leaves those fields undefined", () => {
  const params = buildRecipientAccountParams({
    providerPage: { id: "page-2", display_name: null },
    contactEmail: "",
  });

  assert.equal(params.display_name, undefined);
  assert.equal(params.contact_email, undefined);
});
