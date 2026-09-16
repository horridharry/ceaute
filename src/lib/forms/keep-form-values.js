import { startTransition } from "react";

// React resets a <form action={fn}> after the action completes. Controlled
// <input> and <textarea> elements survive because React mirrors their value
// into the default value, but controlled <select> and checkbox elements do not,
// so the DOM briefly shows the first option or the mount-time checked state
// while React state still holds what the user chose.
//
// Forms whose state is the source of truth submit through this handler
// instead: it runs the same action inside a transition without the reset.
// Keep `action={formAction}` on the form as well so it still works before
// hydration.
export function keepFormValuesOnSubmit(formAction) {
  return (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    startTransition(() => {
      formAction(formData);
    });
  };
}
