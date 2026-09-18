// Single source of truth for the operator details UK law requires Ceaute to
// publish. Every page, footer, checkout disclosure and transactional email
// reads from here, so filling in a placeholder updates the whole site in one
// edit rather than in a dozen hardcoded strings.
//
// Ceaute is a sole trader, not a company, so the Companies Act 2006 trading
// disclosures for companies and LLPs do not apply. Three things do:
//   * the geographic address at which the trader is established, required on
//     the site by Electronic Commerce Regulations 2002 reg 6(1)(b) and before
//     the consumer is bound by CCR 2013 Schedule 2(c);
//   * a UK address for service, required by Companies Act 2006 s.1202 because
//     "Ceaute" is not the owner's surname. It may be a third-party service
//     address, so it can differ from the address above;
//   * the trader's name and an email address for rapid, direct contact.
//
// A bracketed value is a placeholder standing in for a fact nobody has
// established yet. It is NOT a verified fact and must never be presented as
// one. `assertLegalIdentityResolved` fails the Production build while any
// remain; see scripts/assert-legal-identity.mjs.

export const legalIdentity = {
  tradingName: "Ceaute",
  structure: "sole trader",
  siteDomain: "ceaute.com",
  // Unresolved as of 18 September 2026 — see
  // docs/reports/2026-09-18-legal-pages-review-note.md.
  operatorName: "Harrison Ndugba",
  businessAddress: "Honour Lea Avenue, Stratford, London, E20 1DX, United Kingdom",
  addressForService: "Honour Lea Avenue, Stratford, London, E20 1DX, United Kingdom",
  contactEmail: "ndu.harry02@gmail.com",
};

// Fields that carry a legal disclosure duty. `structure` and `siteDomain` are
// descriptive copy, so an unfilled value there is a content bug rather than a
// compliance gap, and they are deliberately not listed.
const REQUIRED_FIELDS = [
  "tradingName",
  "operatorName",
  "businessAddress",
  "addressForService",
  "contactEmail",
];

export function isPlaceholder(value) {
  return /^\s*\[.+\]\s*$/.test(String(value ?? ""));
}

export function unresolvedLegalIdentityFields(identity = legalIdentity) {
  return REQUIRED_FIELDS.filter(
    (field) => !identity[field] || isPlaceholder(identity[field]),
  );
}

export function hasUnresolvedLegalIdentity(identity = legalIdentity) {
  return unresolvedLegalIdentityFields(identity).length > 0;
}

// s.1202 allows the address for service to be somewhere other than where the
// business operates, but it only needs stating separately when it actually
// differs.
export function needsSeparateAddressForService(identity = legalIdentity) {
  return (
    Boolean(identity.addressForService) &&
    identity.addressForService !== identity.businessAddress
  );
}

// One sentence naming the trader, used wherever a short attribution is enough
// — the site footer and the transactional email footer.
export function describeOperator(identity = legalIdentity) {
  return `${identity.tradingName} is a trading name of ${identity.operatorName}, a ${identity.structure}.`;
}

// One contiguous sentence for transactional email. Both the HTML and the
// plain-text alternative render this exact string, so the two stay consistent
// and a text-only client still receives the trader identity that CCR 2013
// reg 16 expects on the durable medium.
export function legalContactLine(identity = legalIdentity) {
  return (
    `${identity.tradingName} is a trading name of ${identity.operatorName}, ` +
    `a ${identity.structure}, of ${identity.businessAddress}. ` +
    `Contact: ${identity.contactEmail}`
  );
}

// Throws rather than returns, because the only caller is a build gate that
// must stop a Production publication outright.
export function assertLegalIdentityResolved(identity = legalIdentity) {
  const unresolved = unresolvedLegalIdentityFields(identity);

  if (unresolved.length > 0) {
    throw new Error(
      `Legal identity is incomplete: ${unresolved.join(", ")}. ` +
        "Ceaute cannot publish to Production until src/lib/legal/identity.js " +
        "holds real values. Do not invent them.",
    );
  }
}
