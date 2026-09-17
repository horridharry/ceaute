import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  bookingEmailSubject,
  renderBookingEmailHtml,
  renderBookingEmailText,
} from "./booking-email-content";
import { getBookingEmailConfiguration } from "./booking-email-config";

async function markEmailSent({ supabase, emailId, claimToken, messageId }) {
  const { error } = await supabase.schema("ceaute").rpc(
    "record_booking_email_sent",
    {
      target_email_id: emailId,
      target_claim_token: claimToken,
      target_provider_message_id: messageId,
    },
  );

  if (error) {
    throw new Error("Could not mark booking email as sent.");
  }
}

async function markEmailFailed({ supabase, emailId, claimToken, message }) {
  const { error } = await supabase.schema("ceaute").rpc(
    "record_booking_email_retryable_failure",
    {
      target_email_id: emailId,
      target_claim_token: claimToken,
      target_error: String(message || "Email delivery failed.").slice(0, 1000),
    },
  );

  if (error) {
    throw new Error("Could not mark booking email as failed.");
  }
}

export async function deliverPendingBookingEmails({
  limit = 25,
  supabase: suppliedSupabase,
  fetchImpl = fetch,
  environment = process.env,
} = {}) {
  const configuration = getBookingEmailConfiguration(environment);

  if (!configuration.configured) {
    return {
      claimed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      configured: false,
      diagnostic: configuration.diagnostic,
    };
  }

  const { apiKey, from, appUrl } = configuration;

  const supabase = suppliedSupabase ?? createServiceRoleClient();
  const { data: emails, error } = await supabase.schema("ceaute").rpc(
    "claim_pending_booking_emails",
    {
      max_emails: limit,
    },
  );

  if (error) {
    throw new Error("Could not claim booking emails.");
  }

  const diagnostics = {
    claimed: emails?.length ?? 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const email of emails ?? []) {
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": email.id,
        },
        body: JSON.stringify({
          from,
          to: [email.recipient_email],
          subject: bookingEmailSubject(email),
          html: renderBookingEmailHtml(email, appUrl),
          text: renderBookingEmailText(email, appUrl),
        }),
      });
      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        await markEmailFailed({
          supabase,
          emailId: email.id,
          claimToken: email.claim_token,
          message: body?.message ?? `Resend returned ${response.status}.`,
        });
        diagnostics.failed += 1;
        continue;
      }

      await markEmailSent({
        supabase,
        emailId: email.id,
        claimToken: email.claim_token,
        messageId: body?.id ?? null,
      });
      diagnostics.sent += 1;
    } catch (error) {
      await markEmailFailed({
        supabase,
        emailId: email.id,
        claimToken: email.claim_token,
        message: error instanceof Error ? error.message : "Email delivery failed.",
      });
      diagnostics.failed += 1;
    }
  }

  return {
    ...diagnostics,
    configured: true,
  };
}
