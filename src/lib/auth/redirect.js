// Plain JavaScript so the unit tests can import it without a TypeScript step.
/** @param {unknown} value */
export function validatedNextPath(value) {
  if (
    typeof value !== 'string' ||
    !/^\/(?!\/)[^\\\r\n]*$/.test(value)
  ) {
    return null;
  }

  return value;
}

/** @param {unknown} value */
export function safeNextPath(value) {
  return validatedNextPath(value) ?? '/account';
}
