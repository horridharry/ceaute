import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  formatMoneyFromPence,
  formatSingleDateTime,
} from "@/lib/bookings/booking-display";
import { getBookingEmailConfiguration } from "./booking-email-config";

const EVENT_TITLES = {
  booking_confirmed_customer: "Your booking is confirmed",
  booking_confirmed_provider: "New booking confirmed",
  customer_cancelled_customer: "Your booking was cancelled",
  customer_cancelled_provider: "A customer cancelled a booking",
  provider_cancelled_customer: "Your provider cancelled a booking",
  provider_cancelled_provider: "You cancelled a booking",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function absoluteUrl(path, baseUrl) {
  if (!baseUrl || !path) {
    return "";
  }

  return new URL(path, baseUrl).toString();
}

function addOnsLabel(payload) {
  const addOns = Array.isArray(payload.selected_add_ons)
    ? payload.selected_add_ons
    : [];

  if (!addOns.length) {
    return "None";
  }

  return addOns.map((addOn) => addOn.name).filter(Boolean).join(", ");
}

function addressLines(payload) {
  return [
    payload.address_line_1,
    payload.address_line_2,
    payload.city,
    payload.postcode,
  ].filter(Boolean);
}

function refundStatusLabel(status) {
  if (status === "refunded") {
    return "Refund recorded";
  }

  if (status === "refund_failed") {
    return "Refund failed";
  }

  if (status === "refund_required") {
    return "Refund pending";
  }

  return "Refund status unavailable";
}

function line(label, value) {
  return `${label}: ${value || "Unavailable"}`;
}

// A line that belongs only in some emails; null lines are dropped below.
function optionalLine(label, value) {
  return value ? `${label}: ${value}` : null;
}

function renderTextEmail(email, appUrl) {
  const payload = email.payload ?? {};
  const isCancellation = email.event_type.includes("cancelled");
  const isProvider = email.recipient_role === "provider";
  const bookingPath = isProvider
    ? `/dashboard/bookings/${payload.booking_id}`
    : payload.customer_booking_path;
  const bookingUrl = absoluteUrl(bookingPath, appUrl);
  const lines = [
    EVENT_TITLES[email.event_type],
    "",
    line("Provider", payload.provider_name),
    line("Customer", payload.customer_name),
    // Only the provider needs the customer's contact details.
    optionalLine("Customer email", isProvider ? payload.customer_email : ""),
    optionalLine("Customer phone", isProvider ? payload.customer_phone : ""),
    line("Treatment", payload.treatment_name),
    line("Add-ons", addOnsLabel(payload)),
    line("Appointment", `${formatSingleDateTime(payload.start_at)} - ${formatSingleDateTime(payload.end_at).split(", ").at(-1)}`),
    line("Amount paid", formatMoneyFromPence(payload.amount_paid_pence)),
    line("Due at appointment", formatMoneyFromPence(payload.amount_due_later_pence)),
  ];

  if (!isCancellation) {
    const address = addressLines(payload);
    lines.push(
      line("Cancellation deadline", formatSingleDateTime(payload.cancellation_deadline_at)),
      line("Address", address.length ? address.join(", ") : ""),
      line("Access instructions", payload.access_instructions),
    );
  } else {
    lines.push(
      line("Cancelled by", payload.cancelled_by),
      line("Refund amount", formatMoneyFromPence(payload.refund_amount_pence)),
      line("Retained amount", formatMoneyFromPence(payload.retained_amount_pence)),
      line("Refund status", refundStatusLabel(payload.refund_status)),
    );
  }

  lines.push(line("View booking", bookingUrl));

  return lines.filter((entry) => entry !== null).join("\n");
}

function renderHtmlEmail(email, appUrl) {
  const text = renderTextEmail(email, appUrl);

  return `<div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">${text
    .split("\n")
    .map((entry) =>
      entry
        ? `<p style="margin:0 0 10px">${escapeHtml(entry)}</p>`
        : `<br />`,
    )
    .join("")}</div>`;
}

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
          subject: EVENT_TITLES[email.event_type] ?? "Ceaute booking update",
          html: renderHtmlEmail(email, appUrl),
          text: renderTextEmail(email, appUrl),
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
