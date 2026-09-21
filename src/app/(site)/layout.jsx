import AppHeader from "@/components/app-header/app-header";
import { SiteFooter } from "@/components/site-footer";

export default function SiteLayout({ children }) {
  return (
    <>
      <AppHeader />
      {children}
      <SiteFooter />
    </>
  );
}
