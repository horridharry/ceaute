import Image from "next/image";

function canUseNextImage(url) {
  return typeof url === "string" && url.startsWith("/");
}

export function SmallTreatmentPhoto({ url }) {
  return (
    <div className="relative h-20 w-20 overflow-hidden rounded bg-black/5">
      {canUseNextImage(url) ? (
        <Image src={url} alt="" fill className="object-cover" />
      ) : null}
    </div>
  );
}

