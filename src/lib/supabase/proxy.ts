import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedCustomerPaths = ['/account'];
const providerOnboardingPaths = ['/provider/onboarding', '/provider/setup'];

function isProtectedCustomerPath(pathname: string) {
  return protectedCustomerPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isProviderWorkspacePath(pathname: string) {
  return (
    (pathname === '/provider' || pathname.startsWith('/provider/')) &&
    !providerOnboardingPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}

function isProviderPath(pathname: string) {
  return pathname === '/provider' || pathname.startsWith('/provider/');
}

function redirectToSignIn(request: NextRequest) {
  const nextPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  const redirectUrl = new URL('/sign-in', request.url);
  redirectUrl.searchParams.set('next', nextPath);

  return NextResponse.redirect(redirectUrl);
}

export async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const pathname = request.nextUrl.pathname;

  if ((isProtectedCustomerPath(pathname) || isProviderPath(pathname)) && !userId) {
    return redirectToSignIn(request);
  }

  if (isProviderWorkspacePath(pathname) && userId) {
    const { data: providerPage, error } = await supabase
      .schema('ceaute')
      .from('provider_page')
      .select('id')
      .eq('owner_profile_id', userId)
      .maybeSingle();

    if (error || !providerPage) {
      return NextResponse.redirect(new URL('/provider/onboarding', request.url));
    }
  }

  return response;
}
