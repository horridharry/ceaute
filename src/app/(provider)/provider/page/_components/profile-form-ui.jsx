"use client";
import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";

const cleanUsername = (username) => {
  return username
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._]+/g, "")
    .slice(0, 30);
};

export function ProfileFormUI({ profile, updateProfile }) {
  const [stateMessage, updateProfileAction, pending] = useActionState(
    updateProfile,
    "",
  );

  const loading = false;

  const [username, setUsername] = useState(profile.username || "");
  const [businessName, setBusinessName] = useState(profile.business_name || "");
  const [potentialUsername, setPotentialUsername] = useState("");

  const [usernameError, setUsernameError] = useState(null);
  const [businessNameError, setBusinessNameError] = useState(null);

  const validateUsername = (username) => {
    const usernameRegex = /^[a-zA-Z0-9_-]+$/;
    if (!usernameRegex.test(username)) {
      return "Username can only contain letters, numbers, hyphens, and underscores.";
    }
    if (username.length < 3 || username.length > 30) {
      return "Username must be between 3 and 30 characters long.";
    }
    // Add check for uniqueness against your database here
    return null; // No error
  };

  const handleUsernameChange = (event) => {
    const inputValue = event.target.value;
    setUsernameError(validateUsername(inputValue));
    setUsername(inputValue);
  };

  const handleBusinessNameChange = (event) => {
    const inputValue = event.target.value;
    setBusinessName(inputValue);

    setPotentialUsername(cleanUsername(inputValue));

    if (inputValue === "") {
      setBusinessNameError("Please give your treatment a name");
    } else {
      setBusinessNameError(null);
    }
  };

  const handleBusinessNameBlur = () => {
    // Validate potential username
    const usernameError = validateUsername(potentialUsername);
    //setUsernameError(usernameError);

    // If valid, update the actual username
    if (!usernameError) {
      setUsername(potentialUsername);
    }
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter ">Details</h1>
        <p className="text-sm mt-1">
          Manage details for your public Ceaute page.{" "}
        </p>
        <form
          id="update_details"
          className="flex flex-col gap-4 mt-12"
          action={updateProfileAction}
        >
          <span className="field-set">
            <label className="label" htmlFor="business_name">
              {"Business Name"}
            </label>
            <p
              className={
                businessNameError
                  ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-red-600"
                  : "text-sm transition-opacity ease-in opacity-0 duration-500 text-red-600"
              }
            >
              {businessNameError}
            </p>
            <input
              id="business_name"
              name="business_name"
              required
              defaultValue={businessName}
              onBlur={handleBusinessNameBlur}
              className="field"
              onChange={(event) => handleBusinessNameChange(event)}
            />
          </span>
          <span className="field-set">
            <label className="label" htmlFor="username">
              Fleekd Username
            </label>
            <p
              className={
                usernameError
                  ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-red-600"
                  : "text-sm transition-opacity ease-in opacity-0 duration-500 text-red-600"
              }
            >
              {usernameError}
            </p>
            <div className="relative flex items-center rounded-lg">
              <span className="absolute z-40 ml-3 text-sm opacity-80">
                {"ceaute.com / @"}
              </span>
              <input
                id="username"
                name="username"
                autoComplete="username"
                className="relative w-full appearance-none ring-1 ring-transparent rounded-lg border p-2.5 pl-24 outline-none duration-200 hover:border-black/25 focus:border-pink-600 focus:ring-pink-600"
                value={username}
                required
                onChange={(event) => {
                  handleUsernameChange(event);
                }}
              />
            </div>
          </span>
          <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          <div className="mt-8 flex gap-2 items-center justify-end">
            <Link
              href="/provider"
              className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-3 px-6 text-sm border duration-200 active:bg-pink-500/10  active:border-transparent active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Back
            </Link>
            <SubmitButton
              error={usernameError || businessNameError}
              loading={loading}
              pending={pending}
            />
          </div>
        </form>
      </div>
    </main>
  );
}

const SubmitButton = ({ loading, error, pending }) => {
  return (
    <button
      form="update_details"
      type="submit"
      className="w-max rounded-lg font-semibold bg-pink-700 bg- p-3 px-4 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      aria-disabled={pending || error}
      disabled={pending || loading || error}
    >
      {!pending ? "Update details" : "Updating..."}
    </button>
  );
};
