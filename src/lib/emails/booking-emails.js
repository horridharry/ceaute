import { createServiceRoleClient } from "@/lib/supabase/service-role";
import {
  formatMoneyFromPence,
  formatSingleDateTime,
} from "@/lib/bookings/booking-display";

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

function absoluteUrl(path) {
  const baseUrl = process.env.CEAUTE_APP_URL;

  if (!baseUrl) {
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

function renderTextEmail(email) {
  const payload = email.payload ?? {};
  const isCancellation = email.event_type.includes("cancelled");
  const isProvider = email.recipient_role === "provider";
  const bookingPath = isProvider
    ? payload.provider_booking_path
    : payload.customer_booking_path;
  const bookingUrl = absoluteUrl(bookingPath);
  const lines = [
    EVENT_TITLES[email.event_type],
    "",
    line("Provider", payload.provider_name),
    line("Customer", payload.customer_name),
    line("Customer email", isProvider ? payload.customer_email : ""),
    line("Customer phone", isProvider ? payload.customer_phone : ""),
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

  return lines.filter((entry) => !entry.endsWith(": ")).join("\n");
}

function renderHtmlEmail(email) {
  const text = renderTextEmail(email);

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

export async function deliverPendingBookingEmails({ limit = 25 } = {}) {
  const supabase = createServiceRoleClient();
  const { data: emails, error } = await supabase.schema("ceaute").rpc(
    "claim_pending_booking_emails",
    {
      max_emails: limit,
    },
  );

  if (error) {
    throw new Error("Could not claim booking emails.");
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.CEAUTE_EMAIL_FROM;
  const appUrl = process.env.CEAUTE_APP_URL;
  const diagnostics = {
    claimed: emails?.length ?? 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  if (!apiKey || !from || !appUrl) {
    for (const email of emails ?? []) {
      await markEmailFailed({
        supabase,
        emailId: email.id,
        claimToken: email.claim_token,
        message:
          "Email delivery is not configured. Set RESEND_API_KEY, CEAUTE_EMAIL_FROM and CEAUTE_APP_URL.",
      });
      diagnostics.skipped += 1;
    }

    return {
      ...diagnostics,
      configured: false,
      diagnostic:
        "Email delivery is not configured. Pending emails remain retryable.",
    };
  }

  for (const email of emails ?? []) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
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
          html: renderHtmlEmail(email),
          text: renderTextEmail(email),
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
