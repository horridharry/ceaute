// Plain JavaScript so the unit tests can import it without a TypeScript step.
//
// The WHATWG URL parser used by `new URL(next, base)` strips every ASCII tab
// (U+0009) and newline (U+000A / U+000D) out of its input before parsing it,
// wherever they appear in the string, not just at the edges. That means a
// value like "/\t/evil.example" looks same-site (starts with a single `/`)
// but resolves to the protocol-relative "//evil.example" once those
// characters are removed, sending the user off-site. Rejecting the small set
// of characters that historically caused header/URL smuggling bugs (`\r`,
// `\n`, backslash) is not enough; we reject every ASCII control character so
// none of them can be hiding a similar parser quirk.
/** @param {unknown} value */
export function validatedNextPath(value) {
  if (
    typeof value !== 'string' ||
    /[\x00-\x1f\x7f]/.test(value) ||
    !/^\/(?!\/)[^\\]*$/.test(value)
  ) {
    return null;
  }

  return value;
}

/** @param {unknown} value */
export function safeNextPath(value) {
  return validatedNextPath(value) ?? '/account';
}
