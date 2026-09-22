// Server-side diagnostics for a failed Supabase call. Callers still throw a
// fixed, customer-safe message (the route error boundary shows only a
// digest); this keeps the underlying cause in the server log so a failure
// can be diagnosed. Only Supabase's own error fields are logged, never the
// request, keys or row data.
export function supabaseErrorDetails(error) {
  if (!error) {
    return null;
  }

  const cause = error.cause ?? null;

  return {
    name: error.name ?? null,
    code: error.code ?? null,
    message: String(error.message ?? error),
    details: error.details ?? null,
    hint: error.hint ?? null,
    status: error.status ?? null,
    cause: cause ? String(cause.code ?? cause.message ?? cause) : null,
  };
}

export function logSupabaseError(context, error) {
  console.error(`[supabase] ${context}`, supabaseErrorDetails(error));
}
