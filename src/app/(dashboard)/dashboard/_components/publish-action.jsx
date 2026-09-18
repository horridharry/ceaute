"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ProblemNotice } from "@/components/ui/notice";

// publishPage returns a state object rather than redirecting, because
// publication-actions.jsx on the Page tab reads it. This keeps that contract
// and adds the navigation the checklist needs: on success it moves to the
// published letter, which is a UI concern only.
export function PublishAction({ publishAction, ready }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(publishAction, null);

  useEffect(() => {
    if (state && state.error === false) {
      router.replace("/dashboard?published=1");
    }
  }, [state, router]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {state?.error ? (
        <ProblemNotice title="That did not publish">
          {state.message}
        </ProblemNotice>
      ) : null}
      <Button type="submit" disabled={!ready || pending} aria-disabled={!ready || pending}>
        {pending ? "Publishing…" : "Publish page"}
      </Button>
    </form>
  );
}
