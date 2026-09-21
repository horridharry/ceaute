import AppHeader from "@/components/app-header/app-header";
import { SiteFooter } from "@/components/site-footer";
import NotFoundContent from "@/components/not-found-content";

export default function NotFound() {
  return (
    <>
      <AppHeader />
      <NotFoundContent />
      <SiteFooter />
    </>
  );
}
