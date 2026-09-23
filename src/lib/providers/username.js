// Provider usernames are shared between onboarding, page identity, and the
// server actions behind them. PostgreSQL enforces the same pattern with
// provider_page_username_format and the partial unique index; these helpers
// only give the user early feedback and keep both forms deriving the same
// suggestion from a business name.
//
// A username is 3-30 lowercase letters, numbers, underscores and full stops.
// A full stop can sit between characters (studio.nala) but never first, last
// or twice in a row (approved 23 September 2026). Usernames are stored lower
// case, so uniqueness ignores case.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

// What someone types, cleaned as it always has been: lower case, and only the
// characters a username may contain. Full stops are kept exactly as typed, so
// a misplaced one is reported by validateUsername rather than silently moved.
export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

// A username suggested from a business name. Always the right shape: full
// stops are collapsed and never left at either end.
export function suggestUsername(businessName) {
  return String(businessName ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/\.+$/, "");
}

// Returns a message for an unusable username, or null when it is acceptable.
// An empty username is left to the caller, because onboarding requires one
// while page identity allows clearing it.
export function validateUsername(username) {
  if (!username) {
    return null;
  }

  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Username can only contain lowercase letters, numbers, full stops, and underscores.";
  }

  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    return `Username must be between ${USERNAME_MIN_LENGTH} and ${USERNAME_MAX_LENGTH} characters long.`;
  }

  if (username.startsWith(".") || username.endsWith(".")) {
    return "A full stop can’t come first or last in a username.";
  }

  if (username.includes("..")) {
    return "Use one full stop at a time in a username.";
  }

  return null;
}

// A published page is reached at /@username, so the username cannot be
// cleared while the page stays published. PostgreSQL enforces the same rule
// with provider_page_published_requires_username; this gives the message.
export function usernameRequiredError({ username, status }) {
  if (status === "published" && !username) {
    return "A published page needs a username. Unpublish the page before removing it.";
  }

  return null;
}
