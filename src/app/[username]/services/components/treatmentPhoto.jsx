"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";

export function BigTreatmentPhoto({ url }) {
  const supabase = createClient();
  const [isImageLoading, setImageLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("/images/placeholder.svg");

  useEffect(() => {
    async function getImagePathUrl(downloadImagePath) {
      if (!downloadImagePath || downloadImagePath === photoUrl) {
        return null;
      }

      try {
        const { data, error: downloadError } = await supabase.storage
          .from("fleekd-app-bucket")
          .download(downloadImagePath);

        if (downloadError) {
          throw downloadError;
        }

        const imageUrl = URL.createObjectURL(data);
        setPhotoUrl(imageUrl);
        return imageUrl;
      } catch (error) {
        console.log("Error downloading image: ", error);
      }
    }

    if (url) getImagePathUrl(url);
  }, [url, supabase]);

  console.log("TreatmentsPhoto: Mount");

  return (
    <div className="relative h-64 w-48 rounded-lg overflow-hidden bg-black/5">
      {photoUrl && (
        <Image
          src={photoUrl}
          alt="alt"
          fill
          onLoad={() => setImageLoading(false)}
          className={`object-cover ${isImageLoading ? "blur" : "remove-blur"}`}
        />
      )}
    </div>
  );
}

export function SmallTreatmentPhoto({ url }) {
  const supabase = createClient();
  const [isImageLoading, setImageLoading] = useState(true);
  const [photoUrl, setPhotoUrl] = useState("/images/placeholder.svg");

  useEffect(() => {
    async function getImagePathUrl(downloadImagePath) {
      if (!downloadImagePath || downloadImagePath === photoUrl) {
        return null;
      }

      try {
        const { data, error: downloadError } = await supabase.storage
          .from("fleekd-app-bucket")
          .download(downloadImagePath);

        if (downloadError) {
          throw downloadError;
        }

        const imageUrl = URL.createObjectURL(data);
        setPhotoUrl(imageUrl);
        return imageUrl;
      } catch (error) {
        console.log("Error downloading image: ", error);
      }
    }

    if (url) getImagePathUrl(url);
  }, [url, supabase]);

  console.log("TreatmentsPhoto: Mount");

  return (
    <div className="relative h-16 w-20 rounded overflow-hidden bg-black/5">
      {photoUrl && (
        <Image
          src={photoUrl}
          alt="alt"
          fill
          onLoad={() => setImageLoading(false)}
          className={`object-cover ${isImageLoading ? "blur" : "remove-blur"}`}
        />
      )}
    </div>
  );
}
