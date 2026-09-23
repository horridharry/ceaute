import { normalizeUkPhoneNumber } from "@/lib/phone/normalize";

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 120;

// The one rule for the profile fields a customer edits: on the account
// settings screen and again at booking checkout. Returns either an error
// message or the column values to write to ceaute.profile.
export function parsePersonalDetails({ fullName, phone }) {
  const result = validatePersonalDetails({ fullName, phone });

  if (result.errors) {
    return { error: result.errors.full_name ?? result.errors.phone };
  }

  return result;
}

// The same rule, with a message per field so a form can show each error
// beside its own input.
export function validatePersonalDetails({ fullName, phone }) {
  const customerName = String(fullName ?? "").trim();
  const customerPhone = normalizeUkPhoneNumber(phone);
  const errors = {};

  if (customerName.length < FULL_NAME_MIN_LENGTH) {
    errors.full_name = "Enter your full name.";
  } else if (customerName.length > FULL_NAME_MAX_LENGTH) {
    errors.full_name = `Full name must be ${FULL_NAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!customerPhone) {
    errors.phone = String(phone ?? "").trim()
      ? "Enter a UK phone number, like 07700 900482."
      : "Enter your mobile number.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    values: {
      full_name: customerName,
      phone_e164: customerPhone,
    },
  };
}
