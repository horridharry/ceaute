import { PendingButton } from "@/components/pending-button";

export function SubmitButton() {
  return (
    <PendingButton
      form="booking_details"
      pendingLabel="Continuing..."
      className="w-max rounded-lg bg-pink-700 p-3 px-4 text-sm font-semibold text-white shadow-sm duration-200 hover:bg-pink-800 disabled:cursor-not-allowed disabled:opacity-60 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
    >
      Continue
    </PendingButton>
  );
}
