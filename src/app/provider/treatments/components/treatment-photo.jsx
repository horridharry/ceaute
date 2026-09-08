"use client";
import Image from "next/image";
import { useState } from "react";

export function TreatmentPhoto({ url }) {
  const [isImageLoading, setImageLoading] = useState(true);
  const photoUrl =
    url && String(url).startsWith("/") ? url : "/images/placeholder.svg";

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
