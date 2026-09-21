export const focusedTaskRoutePatterns = [
  /^\/dashboard\/treatment-groups\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/add-ons\/(?:new|[^/]+\/edit)$/,
  /^\/dashboard\/locations\/(?:new|[^/]+\/edit)$/,
];

export function isFocusedTaskRoute(pathname) {
  return focusedTaskRoutePatterns.some((pattern) => pattern.test(pathname));
}
