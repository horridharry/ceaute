import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    redirect('/sign-in?next=/account');
  }

  const { error } = await supabase
    .schema('ceaute')
    .from('provider_page')
    .select('id')
    .eq('owner_profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Could not load your account.');
  }

  return (
    <main className="container max-w-md p-5 bg-white">
      <div className="mt-6 flex flex-col">
        <h1 className="text-2xl font-bold tracking-tighter">Harrison Ndugba</h1>
        <p className="text-sm mt-1">
          Welcome to your Ceaute account
        </p>

        <div className="mt-6 grid gap-4">
          <Link href="/provider/bookings">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">My Account</h3>
                <p className="text-xs mt-1">Manage your account settings</p>
              </article>
            </div>
          </Link>
          <Link href="/provider/profile">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">My Bookings</h3>
                <p className="text-xs mt-1">View and manage your bookings</p>
              </article>
            </div>
          </Link>

        </div>
      </div>
    </main>
  

  );
}


