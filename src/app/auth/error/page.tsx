import AppHeader from '@/components/app-header/app-header';
import { ButtonLink } from '@/components/ui/button';

// B1. The copy here described a magic link long after sign-in became a
// six-digit code. The route itself is a static card with one way out: it has
// no state to resend from, and the pending-auth cookie is deleted on success,
// so there is deliberately no form.
export default function AuthErrorPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 px-5 py-10">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-title text-pretty text-ink">
            That sign-in didn&rsquo;t work.
          </h1>
          <p className="text-body text-black/80">
            The code may have expired or already been used. Your account has not
            been changed.
          </p>
        </div>

        <ButtonLink href="/sign-in" className="w-max px-6" block={false}>
          Return to sign in
        </ButtonLink>

        <p className="text-[12.5px] text-black/60">
          Anything you were booking is still there if the hold has not run out.
        </p>
      </main>
    </>
  );
}
