"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

const PROVIDER_CATEGORIES = [
  "Nails",
  "Lashes",
  "Hair",
  "Brows",
  "Skincare",
  "Makeup",
];

const cleanUsername = (value) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 30);
};

const validateUsername = (username) => {
  if (!username) {
    return null;
  }

  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Username can only contain lowercase letters, numbers, full stops, and underscores.";
  }

  if (username.length < 3 || username.length > 30) {
    return "Username must be between 3 and 30 characters long.";
  }

  return null;
};

export function ProfileFormUI({ profile, updateProfile }) {
  const [stateMessage, updateProfileAction, pending] = useActionState(
    updateProfile,
    "",
  );
  const [businessName, setBusinessName] = useState(profile.business_name || "");
  const [username, setUsername] = useState(profile.username || "");
  const [usernameWasEdited, setUsernameWasEdited] = useState(
    Boolean(profile.username),
  );
  const [businessNameError, setBusinessNameError] = useState(null);
  const [usernameError, setUsernameError] = useState(null);
  const [biographyError, setBiographyError] = useState(null);

  const updateBusinessName = (event) => {
    const nextBusinessName = event.target.value;
    setBusinessName(nextBusinessName);

    if (nextBusinessName && nextBusinessName.trim().length < 2) {
      setBusinessNameError("Business name must be at least 2 characters long.");
    } else {
      setBusinessNameError(null);
    }

    if (!usernameWasEdited) {
      const suggestedUsername = cleanUsername(nextBusinessName);
      setUsername(suggestedUsername);
      setUsernameError(validateUsername(suggestedUsername));
    }
  };

  const updateUsername = (event) => {
    const nextUsername = cleanUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(nextUsername);
    setUsernameError(validateUsername(nextUsername));
  };

  const updateBiography = (event) => {
    if (event.target.value.length > 500) {
      setBiographyError("Biography must be 500 characters or fewer.");
      return;
    }

    setBiographyError(null);
  };

  const hasClientError = businessNameError || usernameError || biographyError;

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter">Page identity</h1>

        <form
          id="update_details"
          className="mt-12 flex flex-col gap-4"
          action={updateProfileAction}
        >
          <span className="field-set">
            <label className="label" htmlFor="business_name">
              Business name
            </label>
            <p
              className={
                businessNameError
                  ? "text-sm text-red-600 opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-red-600 opacity-0 transition-opacity duration-500 ease-in"
              }
            >
              {businessNameError || "Business name is valid"}
            </p>
            <input
              id="business_name"
              name="business_name"
              value={businessName}
              onChange={updateBusinessName}
              className="field"
            />
          </span>

          <span className="field-set">
            <label className="label" htmlFor="username">
              Username
            </label>
            <p
              className={
                usernameError
                  ? "text-sm text-red-600 opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-red-600 opacity-0 transition-opacity duration-500 ease-in"
              }
            >
              {usernameError || "Username is valid"}
            </p>
            <div className="relative flex items-center rounded-lg">
              <span className="absolute z-40 ml-3 text-sm opacity-80">/@</span>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={updateUsername}
                className="relative w-full appearance-none rounded-lg border p-2.5 pl-10 outline-none ring-1 ring-transparent duration-200 hover:border-black/25 focus:border-pink-600 focus:ring-pink-600"
              />
            </div>
          </span>

          <span className="field-set">
            <label className="label" htmlFor="provider_category">
              Provider category
            </label>
            <select
              id="provider_category"
              name="provider_category"
              defaultValue={profile.provider_category || ""}
              className="field cursor-pointer"
            >
              <option value="">Select a category</option>
              {PROVIDER_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </span>

          <span className="field-set">
            <label className="label" htmlFor="biography">
              Biography
            </label>
            <p
              className={
                biographyError
                  ? "text-sm text-red-600 opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-red-600 opacity-0 transition-opacity duration-500 ease-in"
              }
            >
              {biographyError || "Biography is valid"}
            </p>
            <textarea
              id="biography"
              name="biography"
              rows={5}
              maxLength={500}
              defaultValue={profile.biography || ""}
              onChange={updateBiography}
              className="field resize-none"
            />
          </span>

          <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          {username ? (
            <p className="text-sm text-black/60">
              Future public URL: /@{username}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-end">
            <Link
              href="/provider/page/location"
              className="mr-auto w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Location
            </Link>
            <Link
              href="/provider/page/portfolio"
              className="mr-2 w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Portfolio
            </Link>
            <Link
              href="/provider/page/preview"
              className="mr-2 w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-pink-600 duration-200 hover:border-black/20 active:border-transparent active:bg-pink-500/10 active:text-pink-500"
            >
              Preview page
            </Link>
            <button
              form="update_details"
              type="submit"
              disabled={pending || Boolean(hasClientError)}
              aria-disabled={pending || Boolean(hasClientError)}
              className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
