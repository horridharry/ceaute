import { getTreatmentById } from "../actions";
import { SingleTreatmentUI } from "../components/SingleTreatmentUI";

export default async function SingleTreatmentPage({
  params: { username, serviceId },
}) {
  const decodedUsername = decodeURIComponent(username).slice(1);
  const singleTreatment = await getTreatmentById(serviceId);

  return (
    <SingleTreatmentUI
      singleTreatment={singleTreatment}
      decodedUsername={decodedUsername}
    />
  );
}

export async function generateMetadata({ params: { username, serviceId } }) {
  const decodedUsername = decodeURIComponent(username).slice(1);
  const singleTreatment = await getTreatmentById(serviceId);

  if (singleTreatment) {
    return {
      title: `${singleTreatment.name} - Fleekd`,
      description:
        singleTreatment.description || "Book this treatment on Fleekd.",
      openGraph: {
        title: `${singleTreatment.name} - Fleekd`,
        description:
          singleTreatment.description || "Book this treatment on Fleekd.",
        url: `https://fleekd.co.uk/@${decodedUsername}/services`, // Update with the correct URL structure
        type: "website",
        images: [
          {
            url:
              singleTreatment.image_url ||
              "https://fleekd.co.uk/fleekd_logo.png", // Default image if not available
            width: 1200,
            height: 630,
            alt: singleTreatment.name,
          },
        ],
      },
      // ... other metadata properties ...
    };
  } else {
    // Handle the case where the treatment is not found
    return {
      title: "Treatments - Fleekd",
      description:
        "Discover and book beauty treatments with talented beauty techs on Fleekd.",
      // ... other default metadata ...
    };
  }
}
