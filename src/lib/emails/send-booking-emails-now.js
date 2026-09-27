import { after } from "next/server";
import { deliverPendingBookingEmails } from "./booking-emails";

// Runs the same claim-based delivery as GET /api/cron/send-booking-emails once the
// response is sent. Duplicates are prevented by the database claim
// (ceaute.claim_pending_booking_emails, skip-locked with a lease), the outbox's unique
// (booking_id, event_type, recipient_email) key and the Resend Idempotency-Key set to the
// outbox row id, so a pass that overlaps the 10-minute Supabase Cron sweep is harmless.
// It never throws, so an email can never block the booking, cancellation or refund that caused it. See docs/decisions/009.
export function sendBookingEmailsAfterResponse({
  schedule = after,
  deliver = deliverPendingBookingEmails,
} = {}) {
  try {
    schedule(async () => {
      try {
        await deliver();
      } catch (error) {
        console.error(
          "Immediate booking email pass failed; the scheduled pass will retry.",
          error instanceof Error ? error.message : "Unknown error.",
        );
      }
    });
  } catch (error) {
    console.error(
      "Could not schedule the immediate booking email pass; the scheduled pass will retry.",
      error instanceof Error ? error.message : "Unknown error.",
    );
  }
}
