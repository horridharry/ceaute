import type { ReactNode } from "react";

function SettingsHeader() {
    return (<nav className=" ">
        <p> Settings</p>

    </nav>)
}
export default function AccountLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
  <>
    <SettingsHeader />
        {children}</>
  );
}




