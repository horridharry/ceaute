'use client';

import Link from 'next/link';
import { useFormStatus } from 'react-dom';

type RegisterFormProps = {
  action: (formData: FormData) => Promise<void>;
  errorMessage: string | null;
  next: string | null;
  sent: boolean;
};

function loginHref(next: string | null) {
  const params = new URLSearchParams({ mode: 'login' });

  if (next) {
    params.set('next', next);
  }

  return `/sign-in?${params.toString()}`;
}

export function RegisterForm({ action, errorMessage, next, sent }: RegisterFormProps) {
  return (
    <main className="container mx-auto w-full max-w-md p-5">
      <div className="mt-12 flex flex-col">
        <Link href="/" className="flex w-max items-center gap-x-1">
          <span className="select-none text-xs font-bold uppercase tracking-widest opacity-70">
            Ceaute
          </span>
        </Link>

        <h1 className="mt-8 text-2xl font-bold tracking-tight text-black/90">
          Create a Ceaute account
        </h1>
        <p className="font-medium text-black/70">One last step before starting.</p>

        {sent ? (
          <div className="mt-6 rounded-xl bg-black/5 p-4 text-sm" role="status">
            <strong className="block text-black/90">Check your email.</strong>
            <span className="text-black/70">Use the secure link to finish creating your account.</span>
          </div>
        ) : (
          <form className="mt-6 grid gap-2" action={action}>
            <input name="next" type="hidden" value={next ?? ''} />
            <label htmlFor="full_name" className="text-sm">
              Full name
            </label>
            <input
              autoComplete="name"
              autoFocus
              className="w-full appearance-none rounded-xl border p-3 outline-none ring-2 ring-transparent duration-200 hover:border-black/30 focus:border-pink-600 focus:ring-pink-200"
              id="full_name"
              name="full_name"
              required
              type="text"
            />
            <label htmlFor="email" className="mt-4 text-sm">
              Email
            </label>
            <input
              autoComplete="email"
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
            <RegisterButton />
          </form>
        )}

        <p className="mt-6 text-sm">
          Already have a Ceaute account?{' '}
          <Link
            href={loginHref(next)}
            className="text-pink-600 duration-200 hover:text-pink-700"
          >
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function RegisterButton() {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={pending}
      className="mt-4 rounded-lg bg-pink-600 p-2.5 text-sm font-medium text-white shadow-sm duration-200 hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
      disabled={pending}
      type="submit"
    >
      {pending ? 'Sending link...' : 'Create account'}
    </button>
  );
}
