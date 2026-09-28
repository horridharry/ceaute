// Stripe names each outstanding requirement with a machine-readable path such
// as "representative.date_of_birth.day". Providers see what they will be asked
// for instead: parts of one detail collapse into a single line, and anything
// not recognised is summarised once as "Other details" rather than shown raw.
// Stripe's hosted onboarding, behind "Continue setup", asks for the specifics.
const RULES = [
  [/^external_account\b/, () => "Bank account for payouts"],
  [/terms_of_service/, () => "Accept Stripe's terms"],
  [/\bentity_type$/, () => "Business type"],
  [/\bdate_of_birth\b/, () => "Date of birth"],
  [/\b(given_name|surname|first_name|last_name)$/, () => "Legal name"],
  [
    /\baddress\b/,
    (path) =>
      /^(representative|identity\.individual)\b/.test(path)
        ? "Home address"
        : "Business address",
  ],
  [/\bphone$/, () => "Phone number"],
  [/\bemail$/, () => "Email address"],
  [/\bid_number\b/, () => "ID number"],
  [/\bverification\.additional_document\b/, () => "Proof of address"],
  [/\bverification\.document\b/, () => "Photo ID"],
  [/\brelationship\.title$/, () => "Job title"],
  [/\bnationality$/, () => "Nationality"],
  [/\burl$/, () => "Business website"],
  [/\b(product_description|mcc|industry)$/, () => "What your business does"],
];

const OTHER = "Other details";

// Stripe lists requirements alphabetically; this is the order a person would
// give the details in: who they are, then the business, the bank, the terms.
const ORDER = [
  "Legal name",
  "Date of birth",
  "Home address",
  "Phone number",
  "Email address",
  "Nationality",
  "ID number",
  "Photo ID",
  "Proof of address",
  "Job title",
  "Business type",
  "Business address",
  "Business website",
  "What your business does",
  "Bank account for payouts",
  "Accept Stripe's terms",
];

export function describeStripeRequirements(requirements) {
  const labels = [];
  let other = false;

  for (const path of requirements ?? []) {
    const rule = RULES.find(([pattern]) => pattern.test(String(path)));

    if (!rule) {
      other = true;
      continue;
    }

    const label = rule[1](String(path));

    if (!labels.includes(label)) {
      labels.push(label);
    }
  }

  labels.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

  return other ? [...labels, OTHER] : labels;
}
