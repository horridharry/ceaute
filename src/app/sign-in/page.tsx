import { redirect } from 'next/navigation';
import { validatedNextPath } from '@/lib/auth/redirect';
import { createClient } from '@/lib/supabase/server';
import { requestLogin, requestRegistration } from './actions';
import { LoginForm } from './login-form';
import { RegisterForm } from './register-form';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    mode?: string;
    next?: string;
    sent?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const mode = params.mode === 'register' ? 'register' : 'login';
  const next = validatedNextPath(params.next ?? null);
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    if (next) {
      redirect(next);
    }

    const { data: providerPage, error } = await supabase
      .schema('ceaute')
      .from('provider_page')
      .select('id')
      .eq('owner_profile_id', data.claims.sub)
      .maybeSingle();

    if (error) {
      throw new Error('Could not choose your sign-in destination.');
    }

    redirect(providerPage ? '/provider' : '/account');
  }

  const errorMessage =
    params.error === 'invalid-email'
      ? 'Enter a valid email address.'
      : params.error === 'invalid-name'
        ? 'Enter your full name.'
      : params.error
        ? mode === 'register'
          ? 'We could not create your account. Check the details and try again.'
          : 'We could not sign you in. Check the email or create an account.'
        : null;

  const formProps = {
    errorMessage,
    next,
    sent: params.sent === '1',
  };

  return mode === 'register' ? (
    <RegisterForm action={requestRegistration} {...formProps} />
  ) : (
    <LoginForm action={requestLogin} {...formProps} />
  );
}
