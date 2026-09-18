"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { normalizeUsername, validateUsername } from "../../_lib/username";

const PROVIDER_CATEGORIES = [
  "Nails",
  "Lashes",
  "Hair",
  "Brows",
  "Skincare",
  "Makeup",
];

export function ProviderPageForm({ providerPage, updateProviderPage }) {
  const [stateMessage, updateProviderPageAction, pending] = useActionState(
    updateProviderPage,
    "",
  );
  const [businessName, setBusinessName] = useState(providerPage.businessName || "");
  const [username, setUsername] = useState(providerPage.username || "");
  const [usernameWasEdited, setUsernameWasEdited] = useState(
    Boolean(providerPage.username),
  );
  // Controlled so a failed save keeps the edited biography instead of
  // resetting the textarea to the last saved value.
  const [biography, setBiography] = useState(providerPage.biography || "");
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
      const suggestedUsername = normalizeUsername(nextBusinessName);
      setUsername(suggestedUsername);
      setUsernameError(validateUsername(suggestedUsername));
    }
  };

  const updateUsername = (event) => {
    const nextUsername = normalizeUsername(event.target.value);
    setUsernameWasEdited(true);
    setUsername(nextUsername);
    setUsernameError(validateUsername(nextUsername));
  };

  const updateBiography = (event) => {
    const nextBiography = event.target.value;
    setBiography(nextBiography);
    setBiographyError(
      nextBiography.length > 500
        ? "Biography must be 500 characters or fewer."
        : null,
    );
  };

  const hasClientError = businessNameError || usernameError || biographyError;

  return (
    <form
      id="update_details"
      className="flex flex-col gap-[13px]"
      action={updateProviderPageAction}
    >
          <span className="field-set">
            <label className="label" htmlFor="business_name">
              Business name
            </label>
            <p
              className={
                businessNameError
                  ? "text-sm text-bad opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-bad opacity-0 transition-opacity duration-500 ease-in"
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
                  ? "text-sm text-bad opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-bad opacity-0 transition-opacity duration-500 ease-in"
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
                className="relative w-full appearance-none rounded-lg border p-2.5 pl-10 outline-none ring-1 ring-transparent duration-200 hover:border-black/25 focus:border-plum focus:ring-plum"
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
              defaultValue={providerPage.providerCategory || ""}
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
                  ? "text-sm text-bad opacity-100 transition-opacity duration-500 ease-in"
                  : "text-sm text-bad opacity-0 transition-opacity duration-500 ease-in"
              }
            >
              {biographyError || "Biography is valid"}
            </p>
            <textarea
              id="biography"
              name="biography"
              rows={5}
              maxLength={500}
              value={biography}
              onChange={updateBiography}
              className="field resize-none"
            />
          </span>

          <p className="mt-4 text-sm text-bad">{stateMessage}</p>
          {username ? (
            <p className="text-sm text-black/60">
              Future public URL: /@{username}
            </p>
          ) : null}

          <div className="mt-8 flex items-center justify-end">
            <Link
              href="/dashboard/locations"
              className="mr-auto w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-plum duration-200 hover:border-black/20 active:border-transparent active:bg-surface active:text-plum-hover"
            >
              Location
            </Link>
            <Link
              href="/dashboard/profile/portfolio"
              className="mr-2 w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-plum duration-200 hover:border-black/20 active:border-transparent active:bg-surface active:text-plum-hover"
            >
              Portfolio
            </Link>
            <Link
              href="/dashboard/profile/preview"
              className="mr-2 w-max rounded-lg border border-black/10 p-3 px-6 text-sm font-semibold text-plum duration-200 hover:border-black/20 active:border-transparent active:bg-surface active:text-plum-hover"
            >
              Preview page
            </Link>
            <button
              form="update_details"
              type="submit"
              disabled={pending || Boolean(hasClientError)}
              aria-disabled={pending || Boolean(hasClientError)}
              className="w-max rounded-lg bg-plum p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-plum-hover disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
    </form>
  );
}
