// The create and edit screens of treatments, treatment groups, add-ons and
// locations. Since 23 September 2026 they keep the app header (with a back
// link, a heading and Discard beside the save action); the list is still
// used to keep the setup guide off them.
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
