import type { ReactNode } from "react";
import AppHeader from "@/components/app-header/app-header";

export default function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <AppHeader />
      {children}
    </>
  );
}
