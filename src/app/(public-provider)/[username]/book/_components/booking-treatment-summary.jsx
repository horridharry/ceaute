import {
  formatDurationMinutes,
  formatPricePence,
} from "../../_lib/public-provider-format";
import { SmallTreatmentPhoto } from "./treatment-photo";

export const BookingTreatmentSummary = ({ treatment }) => (
  <div className="rounded-xl border border-black/10 p-2.5">
    <div className="flex h-full items-center gap-2.5">
      <SmallTreatmentPhoto url={treatment.image_url} />
      <div className="max-w-sm flex-1 overflow-hidden text-ellipsis">
        <h2 className="font-medium">{treatment.name}</h2>
        <p className="truncate text-sm text-black/60">
          {treatment.description}
        </p>
        <span className="mt-3 flex gap-1 text-sm font-medium">
          <p>{formatPricePence(treatment.price_pence)}</p>
          <p>•</p>
          <p>{formatDurationMinutes(treatment.duration_minutes)}</p>
        </span>
      </div>
    </div>
  </div>
);
