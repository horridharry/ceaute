import { ProviderNav } from "./_components/provider-nav";

export default async function ProviderLayout({ children }) {
  return (
    <div>
      <ProviderNav />
      {children}
    </div>
  );
}
