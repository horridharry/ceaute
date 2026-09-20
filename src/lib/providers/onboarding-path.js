import { validatedNextPath } from "@/lib/auth/redirect";

export const PROVIDER_ONBOARDING_PATH = "/dashboard/onboarding";

export function providerWorkspacePath(value) {
  const path = validatedNextPath(value);

  if (
    !path ||
    path === PROVIDER_ONBOARDING_PATH ||
    path.startsWith(`${PROVIDER_ONBOARDING_PATH}?`) ||
    !(path === "/dashboard" || path.startsWith("/dashboard/"))
  ) {
    return null;
  }

  return path;
}

export function providerOnboardingPath(nextValue) {
  const next = providerWorkspacePath(nextValue);

  if (!next) {
    return PROVIDER_ONBOARDING_PATH;
  }

  return `${PROVIDER_ONBOARDING_PATH}?${new URLSearchParams({ next })}`;
}
