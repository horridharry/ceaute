"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { normalizeUsername, validateUsername } from "../../_lib/username";

export function ProviderOnboardingForm({ action, providerPage }) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [businessName, setBusinessName] = useState(providerPage.businessName);
  const [username, setUsername] = useState(providerPage.username);
  // A saved or hand-typed username belongs to the user; only an untouched one
  // keeps following the business name.
  const [usernameWasEdited, setUsernameWasEdited] = useState(
    Boolean(providerPage.username),
  );
  const [usernameError, setUsernameError] = useState("");
  // Controlled like the other fields so a failed submission does not reset it.
  const [biography, setBiography] = useState(providerPage.biography);

  const updateBusinessName = (event) => {
    const value = event.target.value;
    setBusinessName(value);

    if (!usernameWasEdited) {
      const suggestedUsername = normalizeUsername(value);
      setUsername(suggestedUsername);
      setUsernameError(validateUsername(suggestedUsername) ?? "");
    }
  };

  const updateUsername = (event) => {
    const value = normalizeUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(value);
    setUsernameError(validateUsername(value) ?? "");
  };

  return (
    <form className="mt-8 flex flex-col gap-4" action={formAction}>
      <span className="field-set">
        <label className="label" htmlFor="business_name">
          Business Name
        </label>
        <input
          id="business_name"
          name="business_name"
          required
          value={businessName}
          onChange={updateBusinessName}
          className="field"
        />
      </span>

      <span className="field-set">
        <label className="label" htmlFor="username">
          Ceaute Username
        </label>
        <p
          className={
            usernameError
              ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-bad"
              : "text-sm transition-opacity ease-in opacity-0 duration-500 text-bad"
          }
        >
          {usernameError || "Username is valid"}
        </p>
        <div className="relative flex items-center rounded-lg">
          <span className="absolute z-40 ml-3 text-sm opacity-80">
            ceaute.com /@
          </span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            value={username}
            onChange={updateUsername}
            className="relative w-full appearance-none ring-1 ring-transparent rounded-lg border p-2.5 pl-28 outline-none duration-200 hover:border-black/25 focus:border-plum focus:ring-plum"
          />
        </div>
      </span>

      <span className="field-set">
        <label className="label" htmlFor="biography">
          Short bio
        </label>
        <textarea
          id="biography"
          name="biography"
          value={biography}
          onChange={(event) => setBiography(event.target.value)}
          rows={4}
          maxLength={500}
          className="field resize-none"
        />
      </span>

      <p className="text-sm text-bad">{stateMessage}</p>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Link
          href="/account"
          className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-plum p-3 px-6 text-sm border duration-200 active:bg-surface active:border-transparent active:text-plum-hover"
        >
          Back
        </Link>
        <button
          type="submit"
          disabled={pending || Boolean(usernameError)}
          aria-disabled={pending || Boolean(usernameError)}
          className="w-max rounded-lg font-semibold bg-plum p-3 px-4 text-sm text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
