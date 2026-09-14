import {
  deletePortfolioImage,
  getPortfolioImages,
  movePortfolioImage,
  setPortfolioImageVisibility,
  updatePortfolioImageCaption,
  uploadPortfolioImage,
} from "./actions";
import { PortfolioPageUI } from "./_components/portfolio-page-ui";

export default async function DashboardPortfolioPage() {
  const images = await getPortfolioImages();

  return (
    <PortfolioPageUI
      images={images}
      uploadPortfolioImage={uploadPortfolioImage}
      updatePortfolioImageCaption={updatePortfolioImageCaption}
      movePortfolioImage={movePortfolioImage}
      setPortfolioImageVisibility={setPortfolioImageVisibility}
      deletePortfolioImage={deletePortfolioImage}
    />
  );
}
