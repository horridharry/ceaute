import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const email = data?.claims?.email;
  const name =
    typeof data?.claims?.user_metadata === 'object' &&
    data.claims.user_metadata !== null &&
    'name' in data.claims.user_metadata
      ? String(data.claims.user_metadata.name)
      : null;

  if (!userId) {
    redirect('/sign-in?next=/account');
  }

  const { data: providerPage, error } = await supabase
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
        <h1 className="text-3xl font-bold tracking-tighter">Account</h1>
        <p className="mt-1 text-sm">
          Manage your shared Ceaute identity here.
        </p>

        <div className="mt-6 grid gap-4">
          <div className="rounded-xl border p-3">
            <h2 className="text-sm font-semibold text-pink-600">
              Signed in as
            </h2>
            <p className="mt-1 text-sm">{name || email || 'Your account'}</p>
          </div>

          <Link href="/account/bookings">
            <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
              <article className="mt-8">
                <h3 className="text-pink-600 font-semibold">My bookings</h3>
                <p className="text-xs mt-1">View your personal bookings</p>
              </article>
            </div>
          </Link>

          {providerPage ? (
            <Link href="/provider">
              <div className="h-full items-end flex p-3 duration-200 hover:border-black/20 border rounded-xl">
                <article className="mt-8">
                  <h3 className="text-pink-600 font-semibold">
                    Provider workspace
                  </h3>
                  <p className="text-xs mt-1">
                    Return to the provider side of your account
                  </p>
                </article>
              </div>
            </Link>
          ) : null}

        </div>
      </div>
    </main>
  

  );
}


