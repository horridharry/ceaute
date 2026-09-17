"use client";

import { useActionState } from "react";

const idleState = { error: false, message: "" };

// Publish and unpublish were plain forms whose returned message was thrown
// away, so a database rejection left the screen unchanged. One action state
// serves both buttons: whichever ran last owns the message shown.
export function PublicationActions({
  status,
  ready,
  publishPage,
  unpublishPage,
}) {
  const [state, formAction, pending] = useActionState(
    async (_currentState, formData) =>
      formData.get("intent") === "unpublish"
        ? unpublishPage()
        : publishPage(),
    idleState,
  );

  const showUnpublish = status === "published";
  const showPublish = !showUnpublish && ready && status !== "suspended";

  return (
    <div className="mt-5 flex flex-col items-end gap-3">
      {showUnpublish || showPublish ? (
        <form action={formAction}>
          <input
            type="hidden"
            name="intent"
            value={showUnpublish ? "unpublish" : "publish"}
          />
          {showUnpublish ? (
            <button
              type="submit"
              disabled={pending}
              aria-disabled={pending}
              className="rounded-lg border border-black/10 p-3 px-4 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Unpublishing..." : "Unpublish page"}
            </button>
          ) : (
            <button
              type="submit"
              disabled={pending}
              aria-disabled={pending}
              className="rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Publishing..." : "Publish page"}
            </button>
          )}
        </form>
      ) : null}
      {state.message ? (
        <p
          role="status"
          className={`text-sm ${state.error ? "text-red-600" : "text-black/60"}`}
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
