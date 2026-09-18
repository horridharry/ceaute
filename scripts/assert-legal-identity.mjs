// Build gate: refuses a Production publication while the operator details UK
// law requires are still placeholders.
//
// Local development and Vercel Preview builds pass unchanged, so this cannot
// get in the way of building or reviewing the site. Only a Production build —
// or an explicit CEAUTE_REQUIRE_LEGAL_IDENTITY=1, which is how you test the
// gate itself — is allowed to fail.
//
// The fix is never to weaken this check. It is to put real values in
// src/lib/legal/identity.js.

import {
  legalIdentity,
  unresolvedLegalIdentityFields,
} from "../src/lib/legal/identity.js";

const isProductionPublish =
  process.env.VERCEL_ENV === "production" ||
  process.env.CEAUTE_REQUIRE_LEGAL_IDENTITY === "1";

const unresolved = unresolvedLegalIdentityFields(legalIdentity);

if (unresolved.length === 0) {
  console.log("Legal identity check: all required operator details are set.");
  process.exit(0);
}

const summary = unresolved
  .map((field) => `  - ${field}: ${legalIdentity[field]}`)
  .join("\n");

if (!isProductionPublish) {
  console.warn(
    `Legal identity check: ${unresolved.length} placeholder(s) still unresolved.\n${summary}\n` +
      "Allowed here because this is not a Production build. A Production " +
      "build will fail until these are real values.",
  );
  process.exit(0);
}

console.error(
  `Legal identity check FAILED: ${unresolved.length} required operator ` +
    `detail(s) are still placeholders.\n${summary}\n\n` +
    "Ceaute must publish the trader's name, a geographic business address, a " +
    "UK address for service and a contact email before going live. Set them " +
    "in src/lib/legal/identity.js. Do not invent them, and do not use a home " +
    "address. See docs/reports/2026-09-18-legal-pages-review-note.md.",
);
process.exit(1);
