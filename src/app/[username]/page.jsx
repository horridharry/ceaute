import { redirect } from "next/navigation";
export default async function UsernamePage({ params: { username } }) {
  const decodedUsername = decodeURIComponent(username);
  return redirect(`/${decodedUsername}/services`);
}
