"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useRef } from "react";
import { useActionState } from "react";

import { deleteTreatment, updateTreatment } from "../actions/update-treatment";

export function UpdateTreatmentUI({ treatment, userId }) {
  const [stateMessage, updateTreatmentAction, pending] = useActionState(
    updateTreatment,
    "",
  );

  const [price, setPrice] = useState(treatment.price);
  const [hour, setHour] = useState(treatment.hour);
  const [minute, setMinute] = useState(treatment.minute);
  const duration = hour * 60 + minute;

  const [nameError, setNameError] = useState(null);
  const [priceError, setPriceError] = useState(null);
  const durationError =
    duration < 5 ? "Duration must be at least 5 minutes" : null;

  const loading = false;

  const handleNameBlur = (event) => {
    const inputValue = event.target.value;

    if (inputValue === "") {
      setNameError("Please give your treatment a name");
    } else {
      setNameError(null);
    }
  };

  const handlePriceChange = (event) => {
    const inputValue = event.target.value;
    const numericValue = inputValue.replace(/[^0-9.]/g, ""); // Remove non-numeric characters

    if (inputValue !== numericValue) {
      setPriceError("Please enter only numbers and decimals");
    } else {
      setPriceError(null);
    }

    setPrice(inputValue);
  };

  const handleHourChange = (event) => {
    const inputValue = event.target.value;

    setHour(parseInt(inputValue, 10));
  };

  const handleMinuteChange = (event) => {
    const inputValue = event.target.value;

    setMinute(parseInt(inputValue, 10));
  };

  const [interacted, setInteracted] = useState({
    removeBtn: false,
    updateBtn: false,
  });

  const handleRemove = async () => {
    setInteracted({ removeBtn: true, updateBtn: false });
    await deleteTreatment(treatment.treatment_id);
  };

  const updateTreatmentHandler = (e) => {
    setInteracted({ removeBtn: false, updateBtn: true });
    updateTreatmentAction(e);
  };

  const [imageUrl, setImageUrl] = useState(
    treatment.image_url || "/images/placeholder.svg"
  );
  const [imageUploadError, setImageUploadError] = useState(null);
  const [isImageLoading, setImageLoading] = useState(true);

  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const handleImageUpload = (event) => {
    const file = event.target.files[0];

    // Validation: Check if the file is an image
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Please select an image file.");
      return;
    }

    setImageUploadError(null);

    // Create a preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreviewUrl(reader.result);
    };
    reader.readAsDataURL(file);

    // Handle file upload (e.g., using Supabase storage)
    // ... (upload logic from previous example) ...

    const fileExt = file.name.split(".").pop();
    const filePath = `${userId}-${Math.random()}.${fileExt}`;
    const uploadPath = `${userId}/treatments/${filePath}`;
    setImageUrl(uploadPath);
  };

  const handleSubmit = async (formData) => {
    updateTreatmentHandler(formData);
  };

  return (
    <main className="container max-w-md p-5">
      <div className="mt-6 flex flex-col">
        <h1 className="text-3xl font-bold tracking-tighter ">
          Update treatment
        </h1>
        <form
          id="update_treatment"
          className="flex flex-col gap-4 mt-12"
          action={handleSubmit}
        >
          <span className="field-set">
            <label htmlFor="image" className="label">
              Image
            </label>
            <input
              type="file"
              id="image"
              name="image"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/*"
              className="field hidden"
            />
            <label
              htmlFor="image"
              className="relative w-32 h-32 overflow-hidden cursor-pointer hover:opacity-50 duration-150 bg-black/5"
            >
              <Image
                src={!previewUrl ? "/images/placeholder.svg" : previewUrl} // Replace with your placeholder image path
                alt="Placeholder"
                fill
                onLoad={() => setImageLoading(false)}
                className={`object-cover ${
                  isImageLoading ? "blur" : "remove-blur"
                }`}
              />
            </label>
            <p
              className={
                imageUploadError
                  ? "transition-opacity ease-in opacity-100 duration-500 text-sm text-red-600"
                  : "transition-opacity ease-in opacity-0 duration-500 text-sm text-red-600"
              }
            >
              {imageUploadError}
            </p>
          </span>
          <span className="field-set">
            <label htmlFor="name" className="label">
              Name
            </label>
            <p
              className={
                nameError
                  ? "transition-opacity ease-in opacity-100 duration-500 text-sm text-red-600"
                  : "transition-opacity ease-in opacity-0 duration-500 text-sm text-red-600"
              }
            >
              {nameError}
            </p>
            <input
              id="name"
              name="name"
              onBlur={handleNameBlur}
              required
              defaultValue={treatment.name}
              className="field"
            />
          </span>

          <span className="field-set">
            <label htmlFor="description" className="label">
              Description
            </label>
            <textarea
              type="text"
              id="description"
              name="description"
              className="field"
              defaultValue={treatment.description}
            />
          </span>

          <span className="field-set">
            <label htmlFor="price" className="label">
              Price
            </label>
            <p
              className={
                priceError
                  ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-red-600"
                  : "text-sm transition-opacity ease-in opacity-0 duration-500 text-red-600"
              }
            >
              {priceError}
            </p>
            <input
              type="text"
              id="price"
              name="price"
              required
              value={price}
              onChange={handlePriceChange}
              className="field"
            />
          </span>
          <section>
            <legend className="font-medium">Duration</legend>
            <p
              className={
                durationError
                  ? "text-sm transition-opacity ease-in opacity-100 duration-500 text-red-600"
                  : "text-sm transition-opacity ease-in opacity-0 duration-500 text-red-600"
              }
            >
              {durationError}
            </p>

            <div className="flex gap-4 mt-2">
              <span className="field-set">
                <label htmlFor="hour" className="label">
                  Hour
                </label>
                <select
                  id="hour"
                  className="field cursor-pointer"
                  value={hour}
                  onChange={handleHourChange}
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </span>
              <span className="field-set">
                <label htmlFor="minute" className="label">
                  Minute
                </label>
                <select
                  id="minute"
                  className="field cursor-pointer"
                  value={minute}
                  onChange={handleMinuteChange}
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i} value={i * 5}>
                      {i * 5}
                    </option>
                  ))}
                </select>
              </span>
            </div>
          </section>
          <input
            hidden
            id="duration"
            name="duration"
            type="number"
            value={duration}
            readOnly
          ></input>
          <input
            hidden
            id="category"
            name="category"
            type="number"
            value={""}
            readOnly
          ></input>
          <input
            hidden
            id="treatment_id"
            name="treatment_id"
            type="text"
            value={treatment.treatment_id}
            readOnly
          ></input>
          <input
            hidden
            id="image_url"
            name="image_url"
            type="text"
            value={imageUrl}
            readOnly
          ></input>
          <p className="mt-4 text-sm text-red-600">{stateMessage}</p>
          <div className="mt-8 flex gap-2 items-center ">
            <RemoveButton
              removeHandler={handleRemove}
              loading={loading}
              interacted={interacted}
              pending={pending}
            />
            <Link
              href="/provider/treatments"
              className="w-max rounded-lg font-semibold hover:border-black/20 border-black/10 text-pink-600 p-3 px-6 text-sm border duration-200 active:bg-pink-500/10  active:border-transparent active:text-pink-500 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Back
            </Link>
            <SubmitButton
              error={nameError || durationError || priceError}
              loading={loading}
              interacted={interacted}
              setInteracted={setInteracted}
              pending={pending}
            />
          </div>
        </form>
      </div>
    </main>
  );
}

const RemoveButton = ({
  removeHandler,
  loading,
  interacted,
  pending,
}) => {
  return (
    <button
      type="button"
      onClick={() => {
        removeHandler();
      }}
      aria-disabled={pending}
      disabled={pending || loading}
      className="w-max mr-auto rounded-lg font-semibold hover:bg-rose-50/80 hover:border-transparent border-black/10 text-rose-600 p-3 px-6 text-sm  duration-200 active:bg-rose-600   active:border-transparent active:text-white disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
    >
      {!interacted.removeBtn ? "Remove" : "Removing..."}
    </button>
  );
};

const SubmitButton = ({ loading, error, interacted, setInteracted, pending }) => {
  return (
    <button
      form="update_treatment"
      type="submit"
      onClick={() => setInteracted({ removeBtn: false, updateBtn: true })}
      className="w-max rounded-lg font-semibold bg-pink-700 bg- p-3 px-4 text-sm  text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
      aria-disabled={pending || error}
      disabled={pending || loading || error}
    >
      {!interacted.updateBtn ? "Update treatment" : "Updating..."}
    </button>
  );
};
