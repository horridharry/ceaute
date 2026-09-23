"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formSnapshot, isFormChanged } from "@/lib/forms/form-snapshot";
import { useUnsavedChanges } from "./use-unsaved-changes";

// Unsaved-changes protection for a create or edit form (approved 23 September
// 2026). The form counts as changed when its values differ from the ones it
// loaded with, whether its fields are controlled or not. While changed, the
// shared guard asks before in-app links (including Discard and the back
// link), the header menu and browser Back leave the page.
//
// Submitting releases the guard first, so the redirect after a successful
// save is never intercepted. If the save fails and the form is still on
// screen, the guard comes back as soon as the request settles.
//
// Pass the form's `pending` from useActionState; spread `formProps` on the
// <form>.
export function useFormUnsavedGuard({ pending }) {
  const formRef = useRef(null);
  const initialRef = useRef(null);
  const [changed, setChanged] = useState(false);
  const [released, setReleased] = useState(false);

  const measure = useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    setChanged(isFormChanged(initialRef.current, formSnapshot(new FormData(form))));
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    initialRef.current = formSnapshot(new FormData(form));
    // React resets uncontrolled fields after an action; re-measure once the
    // reset has happened.
    const onReset = () => setTimeout(measure, 0);
    form.addEventListener("input", measure);
    form.addEventListener("change", measure);
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("input", measure);
      form.removeEventListener("change", measure);
      form.removeEventListener("reset", onReset);
    };
  }, [measure]);

  const { allowNextNavigation } = useUnsavedChanges(changed && !released);

  // A request that settles while the form is still mounted did not navigate
  // away (a validation error, for example): protect the edits again.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      setReleased(false);
      measure();
    }
    wasPending.current = pending;
  }, [pending, measure]);

  const onSubmit = useCallback(() => {
    allowNextNavigation();
    setReleased(true);
  }, [allowNextNavigation]);

  return { formProps: { ref: formRef, onSubmit }, changed };
}
