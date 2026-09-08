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
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Dashboard</h1>
        <p className="text-sm mt-1">
          Manage everything to do with your Ceaute account
        </p>


        <div className="mt-6 grid gap-4 grid-cols-2">
          <Link href="/provider/bookings">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Bookings</h3>
                <p className="text-xs mt-1">See all your bookings</p>
              </article>
            </div>
          </Link>
          <Link href="/provider/profile">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Profile</h3>
                <p className="text-xs mt-1">Change your business details</p>
              </article>
            </div>
          </Link>

          <Link href="/provider/availability">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Availability</h3>
                <p className=" text-xs mt-1">Set your opening hours</p>
              </article>
            </div>
          </Link>
          <Link href="/provider/treatments">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">Treatments</h3>
                <p className=" text-xs mt-1">List your treatments</p>
              </article>
            </div>
          </Link>
        </div>
      </div>
    </main>
  

  );
}


