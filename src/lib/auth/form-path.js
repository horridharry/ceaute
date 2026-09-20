import { validatedNextPath } from "@/lib/auth/redirect";

export function authenticationFormPath(
  path,
  { error = null, next = null, email = null } = {},
) {
  const params = new URLSearchParams();
  const safeNext = validatedNextPath(next);
  const enteredEmail = typeof email === "string" ? email.trim() : "";

  if (error) {
    params.set("error", error);
  }

  if (safeNext) {
    params.set("next", safeNext);
  }

  if (enteredEmail) {
    params.set("email", enteredEmail);
  }

  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
