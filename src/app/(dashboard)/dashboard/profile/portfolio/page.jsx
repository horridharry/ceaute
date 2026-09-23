import { getPortfolioImages } from "./queries";
import {
  deletePortfolioImage,
  movePortfolioImage,
  setPortfolioImageVisibility,
  updatePortfolioImageCaption,
  uploadPortfolioImage,
} from "./actions";
import { PortfolioManager } from "./_components/portfolio-manager";

export default async function DashboardPortfolioPage() {
  const { images, pageStatus } = await getPortfolioImages();

  return (
    <PortfolioManager
      images={images}
      isLive={pageStatus === "published"}
      actions={{
        upload: uploadPortfolioImage,
        caption: updatePortfolioImageCaption,
        move: movePortfolioImage,
        visibility: setPortfolioImageVisibility,
        remove: deletePortfolioImage,
      }}
    />
  );
}
