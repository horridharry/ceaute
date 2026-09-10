import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

type CustomerBookingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function buildReturnPath(searchParams: Record<string, string | string[] | undefined>) {
  const params = new URLSearchParams();

  Object.entries(searchParams).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((entry) => params.append(key, entry));
      return;
    }

    if (value !== undefined) {
      params.set(key, value);
    }
  });

  const queryString = params.toString();

  return queryString ? `/account/bookings?${queryString}` : '/account/bookings';
}

export default async function CustomerBookingsPage({
  searchParams,
}: CustomerBookingsPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (!data?.claims?.sub) {
    const returnPath = buildReturnPath(await searchParams);
    redirect(`/sign-in?next=${encodeURIComponent(returnPath)}`);
  }

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Bookings</h1>
        <p className="mt-1 text-sm">
          Customers will manage upcoming, completed and cancelled bookings here.
        </p>
      </div>
    </main>
  );
}
