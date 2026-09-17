import { normalizeUkPhoneNumber } from "@/lib/phone/normalize";

export const FULL_NAME_MIN_LENGTH = 2;
export const FULL_NAME_MAX_LENGTH = 120;

// The one rule for the profile fields a customer edits: on the account
// settings screen and again at booking checkout. Returns either an error
// message or the column values to write to ceaute.profile.
export function parsePersonalDetails({ fullName, phone }) {
  const customerName = String(fullName ?? "").trim();
  const customerPhone = normalizeUkPhoneNumber(phone);

  if (customerName.length < FULL_NAME_MIN_LENGTH) {
    return { error: "Enter your full name." };
  }

  if (customerName.length > FULL_NAME_MAX_LENGTH) {
    return { error: `Full name must be ${FULL_NAME_MAX_LENGTH} characters or fewer.` };
  }

  if (!customerPhone) {
    return { error: "Enter a valid phone number." };
  }

  return {
    values: {
      full_name: customerName,
      phone_e164: customerPhone,
    },
  };
}
