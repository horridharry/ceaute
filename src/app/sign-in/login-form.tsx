'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';

type LoginFormProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  next: string | null;
  sent: boolean;
};

function signInHref(mode: 'login' | 'register', next: string | null) {
  const params = new URLSearchParams({ mode });

  if (next) {
    params.set('next', next);
  }

  return `/sign-in?${params.toString()}`;
}

export function LoginForm({ action, errorMessage, next, sent }: LoginFormProps) {
  return (
    <main className="container mx-auto w-full max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <Link href="/" className="flex w-max items-center gap-x-1">
          <span className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            Ceaute
          </span>
        </Link>

        <h1 className="mt-8 text-2xl font-bold tracking-tight text-black/90">
          Log in
        </h1>
        <p className="font-medium text-black/70">Continue to Ceaute</p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-black/5 p-4 text-sm" role="status">
            <strong className="block text-black/90">Check your email.</strong>
            <span className="text-black/70">Use the secure link we sent to continue.</span>
          </div>
        ) : (
          <form className="mt-6 grid gap-2" action={action}>
            <input name="next" type="hidden" value={next ?? ''} />
            <label htmlFor="email" className="text-sm">
              Email
            </label>
            <input
              autoComplete="email"
              autoFocus
              className="appearance-none rounded-xl border p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-pink-600 focus:ring-pink-200"
              id="email"
              name="email"
              required
              type="email"
            />
            {errorMessage ? (
              <p className="text-sm text-red-600" role="alert">
                {errorMessage}
              </p>
            ) : null}
            <LoginButton />
          </form>
        )}

        <p className="mt-6 text-sm">
          New to Ceaute?{' '}
          <Link
            href={signInHref('register', next)}
            className="text-pink-600 duration-200 hover:text-pink-700"
          >
            Get started.
          </Link>
        </p>
      </div>
    </main>
  );
}

function LoginButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className="mt-4 rounded-lg bg-pink-600 p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Sending link...' : 'Continue'}
    </button>
  );
}
