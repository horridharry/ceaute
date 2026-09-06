export function safeNextPath(value: FormDataEntryValue | string | null) {
  if (
    typeof value !== 'string' ||
    !/^\/(?!\/)[^\\\r\n]*$/.test(value)
  ) {
    return '/account';
  }

  return value;
}
