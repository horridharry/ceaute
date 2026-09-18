'use client';

import { useActionState, useState } from 'react';

type ActionState = { error: boolean; message: string };

type PersonalDetailsFormProps = {
  fullName: string;
  phone: string;
  email: string;
  updatePersonalDetails: (state: ActionState, formData: FormData) => Promise<ActionState>;
};

const idleState: ActionState = { error: false, message: '' };

// Controlled inputs so a rejected save keeps what the customer typed instead
// of resetting to the last saved value when the form action completes.
export default function PersonalDetailsForm({
  fullName,
  phone,
  email,
  updatePersonalDetails,
}: PersonalDetailsFormProps) {
  const [state, formAction, pending] = useActionState(updatePersonalDetails, idleState);
  const [fullNameValue, setFullNameValue] = useState(fullName);
  const [phoneValue, setPhoneValue] = useState(phone);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <span className="field-set">
        <label className="label" htmlFor="full_name">
          Full name
        </label>
        <input
          id="full_name"
          name="full_name"
          type="text"
          required
          autoComplete="name"
          value={fullNameValue}
          onChange={(event) => setFullNameValue(event.target.value)}
          className="field"
        />
      </span>
      <span className="field-set">
        <label className="label" htmlFor="phone">
          Phone number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          value={phoneValue}
          onChange={(event) => setPhoneValue(event.target.value)}
          className="field"
        />
        <p className="text-xs text-black/60">A UK mobile or landline number.</p>
      </span>
      <span className="field-set">
        <span className="label">Email address</span>
        <p className="text-sm">{email || 'Unavailable'}</p>
        <p className="text-xs text-black/60">
          Your email is your sign-in identity and cannot be changed here.
        </p>
      </span>
      {state.message ? (
        <p role="status" className={`text-sm ${state.error ? 'text-bad' : 'text-black/60'}`}>
          {state.message}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        aria-disabled={pending}
        className="mt-2 w-max rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? 'Saving...' : 'Save details'}
      </button>
    </form>
  );
}
