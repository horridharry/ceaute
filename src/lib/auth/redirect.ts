export function validatedNextPath(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== 'string' ||
    !/^\/(?!\/)[^\\\r\n]*$/.test(value)
  ) {
    return null;
  }

  return value;
}

export function safeNextPath(value: FormDataEntryValue | string | null) {
  return validatedNextPath(value) ?? '/account';
}
