import { getProfile } from "./actions";
import { ProfileFormUI } from "./components/profile-form-ui";
import { updateProfile } from "./actions";

export default async function Page() {
  const profile = await getProfile();

  const formattedProfile = {
    ...profile,
  };

  return (
    <ProfileFormUI profile={formattedProfile} updateProfile={updateProfile} />
  );
}
