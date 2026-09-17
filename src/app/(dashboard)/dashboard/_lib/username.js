// Provider usernames are shared between onboarding, page identity, and the
// server actions behind them. PostgreSQL enforces the same pattern with
// provider_page_username_format and the partial unique index; these helpers
// only give the user early feedback and keep both forms deriving the same
// suggestion from a business name.

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

export function normalizeUsername(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
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
