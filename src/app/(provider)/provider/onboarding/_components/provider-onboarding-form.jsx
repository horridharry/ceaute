"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

function cleanUsername(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 30);
}

export function ProviderOnboardingForm({ action, providerPage }) {
  const [stateMessage, formAction, pending] = useActionState(action, "");
  const [businessName, setBusinessName] = useState(providerPage.businessName);
  const [username, setUsername] = useState(providerPage.username);
  const [usernameError, setUsernameError] = useState("");

  const updateBusinessName = (event) => {
    const value = event.target.value;
    setBusinessName(value);

    if (!username) {
      setUsername(cleanUsername(value));
    }
  };

  const updateUsername = (event) => {
    const value = cleanUsername(event.target.value);
    setUsername(value);

    if (value && value.length < 3) {
      setUsernameError("Username must be at least 3 characters long.");
      return;
    }

    setUsernameError("");
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
              ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-red-600"
              : "text-sm transition-opacity ease-in opacity-0 duration-500 text-red-600"
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
            className="relative w-full appearance-none ring-1 ring-transparent rounded-lg border p-2.5 pl-28 outline-none duration-200 hover:border-black/25 focus:border-pink-600 focus:ring-pink-600"
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
          defaultValue={providerPage.biography}
          rows={4}
          maxLength={500}
          className="field resize-none"
        />
      </span>

      <p className="text-sm text-red-600">{stateMessage}</p>

      <div className="mt-4 flex items-center justify-end gap-2">
        <Link
          href="/account"
          className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-3 px-6 text-sm border duration-200 active:bg-pink-500/10 active:border-transparent active:text-pink-500"
        >
          Back
        </Link>
        <button
          type="submit"
          disabled={pending || Boolean(usernameError)}
          aria-disabled={pending || Boolean(usernameError)}
          className="w-max rounded-lg font-semibold bg-pink-700 p-3 px-4 text-sm text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
        >
          {pending ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </form>
  );
}
