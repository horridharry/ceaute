import { getTreatmentsByUsername, getStylistProfile } from "./actions";
import { TreatmentsUI } from "./components/treatmentsUI";

export default async function TreatmentsPage({ params: { username } }) {
  const decodedUsername = decodeURIComponent(username).slice(1);
  const allTreatments = await getTreatmentsByUsername(decodedUsername);

  return (
    <TreatmentsUI
      allTreatments={allTreatments}
      decodedUsername={decodedUsername}
    />
  );
}

export async function generateMetadata({ params: { username } }) {
  const decodedUsername = decodeURIComponent(username).slice(1);

  // Fetch stylist's profile (assuming you have a function for this)
  //const stylistProfile = await getStylistProfile(decodedUsername);

  if (decodedUsername) {
    return {
      title: `@${decodedUsername}'s Services - Fleekd`,
      description: `@${decodedUsername} offers beauty treatments. Book your appointment on Fleekd`,
      openGraph: {
        title: `@${decodedUsername}'s Services - Fleekd`,
        description: `@${decodedUsername} offers beauty treatments. Book your appointment on Fleekd `,
        url: `https://fleekd.co.uk/@${decodedUsername}/services`,
        type: "website",
        images: [
          {
            url:
              decodedUsername.profile_image_url ||
              "https://fleekd.co.uk/fleekd_logo.png",
            width: 1200,
            height: 630,
            alt: `@${decodedUsername} - Beauty Technician`,
          },
        ],
      },
      // ... other metadata properties ...
    };
  } else {
    // Handle case where the stylist profile is not found
    return {
      title: "Beauty Services - Fleekd",
      description:
        "Discover and book beauty treatments with talented beauty techs on Fleekd.",
      // ... other default metadata ...
    };
  }
}
