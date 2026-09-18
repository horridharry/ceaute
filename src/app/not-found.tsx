import AppHeader from '@/components/app-header/app-header';
import { ButtonLink } from '@/components/ui/button';

// The root boundary. A bad @username reaches here because [username]/page.jsx
// calls notFound() and that segment has no not-found file, so this screen has
// no params: it cannot echo the handle or localise its suggestion, and it does
// not pretend to. A segment-level not-found would let it do both.
export default function NotFound() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto flex w-full max-w-[720px] flex-1 flex-col gap-5 px-5 py-10">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-title text-pretty text-ink">
            That page isn&rsquo;t here.
          </h1>
          <p className="text-body text-black/80">
            The link may be out of date, or the provider page may not be
            published yet. Nothing was lost if you had a booking — it is still
            in Bookings.
          </p>
        </div>

        <ButtonLink href="/discover" className="w-max px-6" block={false}>
          Discover providers
        </ButtonLink>

        <ButtonLink href="/account/bookings" variant="tertiary" className="w-max px-6" block={false}>
          Check my bookings
        </ButtonLink>
      </main>
    </>
  );
}
