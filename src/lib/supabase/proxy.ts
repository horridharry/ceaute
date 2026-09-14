import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const protectedCustomerPaths = ['/account'];
const dashboardOnboardingPath = '/dashboard/onboarding';

function isProtectedCustomerPath(pathname: string) {
  return protectedCustomerPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isDashboardWorkspacePath(pathname: string) {
  return (
    (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) &&
    pathname !== dashboardOnboardingPath
  );
}

function isDashboardPath(pathname: string) {
  return pathname === '/dashboard' || pathname.startsWith('/dashboard/');
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

  if ((isProtectedCustomerPath(pathname) || isDashboardPath(pathname)) && !userId) {
    return redirectToSignIn(request);
  }

  if (isDashboardWorkspacePath(pathname) && userId) {
    const { data: providerPage, error } = await supabase
      .schema('ceaute')
      .from('provider_page')
      .select('id')
      .eq('owner_profile_id', userId)
      .maybeSingle();

    // A failed lookup does not show that the provider page is missing, so only
    // a successful lookup with no row may send the user to onboarding.
    if (error) {
      throw new Error('Could not load provider workspace.');
    }

    if (!providerPage) {
      return NextResponse.redirect(new URL(dashboardOnboardingPath, request.url));
    }
  }

  return response;
}
