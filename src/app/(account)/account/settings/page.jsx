import { redirect } from "next/navigation";

// Settings became the Account page (approved 23 September 2026).
export default function AccountSettingsPage() {
  redirect("/account");
}
