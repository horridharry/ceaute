export const focusedTaskRoutePatterns = [
  /^\/dashboard\/treatments\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/treatment-groups\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/add-ons\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/locations\/(?:new|[^/]+\/edit)$/,
];

export function isFocusedTaskRoute(pathname) {
  return focusedTaskRoutePatterns.some((pattern) => pattern.test(pathname));
}

// The setup guide also stays off the create and edit screens (so it can never
// cover a form or its Save button), onboarding and the page preview.
export function isSetupGuideHiddenOn(pathname) {
  return (
    isFocusedTaskRoute(pathname) ||
    pathname === "/dashboard/onboarding" ||
    pathname.startsWith("/dashboard/onboarding/") ||
    pathname === "/dashboard/profile/preview"
  );
}
