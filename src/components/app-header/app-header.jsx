import Link from "next/link";
import { logoutUser } from "@/app/(authenticate)/actions";
import { AvatarMenu } from "@/components/ui/avatar-menu";
import { RootTopBar } from "@/components/ui/top-bar";
import { PAGE_COLUMN } from "@/components/templates/page-column";
import {
  getOwnedProviderPage,
  getRequestSession,
} from "@/lib/auth/request-session";

// The root top bar: wordmark left, avatar right, and nothing else. A customer
// never sees another control up there, and the avatar is never the way out of
// a task — 02-components.md "Navigation".
//
// It is rendered by the screens that want it rather than by the root layout,
// because the stacked, modal and letter templates each supply their own nav
// and must not get a second one.
export default async function AppHeader() {
  const { claims } = await getRequestSession();
  const userId = claims?.sub;

  let hasProviderPage = false;

  if (userId) {
    try {
      // Shares the page's own lookup on a full page load. The header only
      // decides which menu label to show, so a failed lookup must not take the
      // whole screen down.
      hasProviderPage = Boolean(await getOwnedProviderPage(userId));
    } catch {
      hasProviderPage = false;
    }
  }

  const name =
    claims?.user_metadata?.full_name ??
    claims?.user_metadata?.name ??
    claims?.email ??
    "Account";

  return (
    <div className="sticky top-0 z-40 border-b border-black/8 bg-white">
      <div className={PAGE_COLUMN}>
        <RootTopBar homeHref={hasProviderPage ? "/dashboard" : "/discover"}>
          {userId ? (
            <AvatarMenu
              initial={name.slice(0, 1).toUpperCase()}
              hasProviderPage={hasProviderPage}
              providerHref={hasProviderPage ? "/dashboard" : "/dashboard/onboarding"}
              logoutAction={logoutUser}
            />
          ) : (
            <Link
              href="/sign-in"
              className="text-[14px] font-medium text-plum transition duration-150 ease-out hover:text-plum-hover"
            >
              Log in
            </Link>
          )}
        </RootTopBar>
      </div>
    </div>
  );
}
