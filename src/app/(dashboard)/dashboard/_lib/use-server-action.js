"use client";

import { useCallback, useTransition } from "react";

// Runs a server action from a menu item or a dialog button, where there is no
// <form>. It sends the given fields as FormData (the shape every dashboard
// action reads), reports pending while it runs, and resolves with the
// action's result.
export function useServerAction(action) {
  const [pending, startTransition] = useTransition();

  const run = useCallback(
    (fields) =>
      new Promise((resolve) => {
        startTransition(async () => {
          const formData = new FormData();
          for (const [name, value] of Object.entries(fields)) {
            formData.set(name, value);
          }
          resolve(await action(null, formData));
        });
      }),
    [action],
  );

  return [run, pending];
}
