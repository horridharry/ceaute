// Shared HTML layout for Ceaute transactional email. Email clients ignore most
// modern CSS, so the layout is nested tables with inline styles; the <style>
// block is only a progressive enhancement for narrow screens. Every dynamic
// value passes through escapeHtml here, so callers hand over plain strings.

import { legalContactLine } from "@/lib/legal/identity";

const FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const TONES = {
  positive: { accent: "#9d174d", soft: "#fdf2f8", border: "#fbcfe8" },
  neutral: { accent: "#334155", soft: "#f1f5f9", border: "#e2e8f0" },
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeMultiline(value) {
  return escapeHtml(value).replaceAll(/\r?\n/g, "<br />");
}

function renderRow({ label, value }, isLast) {
  const border = isLast ? "" : "border-bottom:1px solid #f0f0f0;";

  return `<tr>
<td class="detail-label" valign="top" width="38%" style="padding:10px 12px 10px 0;${border}font-size:13px;line-height:20px;color:#6b6b6b;">${escapeHtml(label)}</td>
<td class="detail-value" valign="top" style="padding:10px 0;${border}font-size:14px;line-height:20px;color:#1a1a1a;font-weight:600;word-break:break-word;">${escapeMultiline(value)}</td>
</tr>`;
}

function renderSection(section, tone) {
  const rows = section.rows
    .map((row, index) => renderRow(row, index === section.rows.length - 1))
    .join("\n");
  const card = section.highlight
    ? `background-color:${tone.soft};border:1px solid ${tone.border};border-radius:12px;padding:8px 16px;`
    : "padding:0;";

  return `<tr>
<td style="padding:24px 32px 0;" class="gutter">
<p style="margin:0 0 8px;font-size:11px;line-height:16px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${tone.accent};">${escapeHtml(section.heading)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td style="${card}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${rows}
</table>
</td>
</tr>
</table>
</td>
</tr>`;
}

// A padded table cell rather than a styled <a>, so the button keeps its shape
// in Outlook. The raw URL follows for clients that strip links.
function renderAction(action, tone) {
  if (!action?.url) {
    return "";
  }

  const url = escapeHtml(action.url);

  return `<tr>
<td style="padding:28px 32px 0;" class="gutter">
<table role="presentation" cellpadding="0" cellspacing="0" border="0">
<tr>
<td align="center" bgcolor="${tone.accent}" style="border-radius:10px;background-color:${tone.accent};">
<a href="${url}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 26px;font-family:${FONT_STACK};font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${escapeHtml(action.label)}</a>
</td>
</tr>
</table>
<p style="margin:14px 0 0;font-size:12px;line-height:18px;color:#6b6b6b;word-break:break-all;">Or open this link: <a href="${url}" target="_blank" rel="noopener noreferrer" style="color:${tone.accent};text-decoration:underline;">${url}</a></p>
</td>
</tr>`;
}

export function renderEmailLayout({
  title,
  preheader = "",
  badge = "",
  tone: toneName = "positive",
  intro = "",
  sections = [],
  action = null,
  footerNote = "",
}) {
  const tone = TONES[toneName] ?? TONES.positive;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(title)}</title>
<style>
@media only screen and (max-width: 480px) {
  .gutter { padding-left: 20px !important; padding-right: 20px !important; }
  .heading { font-size: 22px !important; line-height: 28px !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background-color:#f6f4f5;-webkit-text-size-adjust:100%;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f6f4f5" style="background-color:#f6f4f5;">
<tr>
<td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;font-family:${FONT_STACK};color:#1a1a1a;">
<tr>
<td style="padding:8px 8px 20px;font-size:13px;line-height:16px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:#9d174d;">ceaute</td>
</tr>
<tr>
<td bgcolor="#ffffff" style="background-color:#ffffff;border:1px solid #ece8ea;border-radius:16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr>
<td bgcolor="${tone.accent}" height="6" style="height:6px;line-height:6px;font-size:0;background-color:${tone.accent};border-radius:16px 16px 0 0;">&nbsp;</td>
</tr>
<tr>
<td style="padding:32px 32px 0;" class="gutter">
${badge ? `<p style="margin:0 0 16px;"><span style="display:inline-block;padding:4px 12px;border-radius:999px;background-color:${tone.soft};border:1px solid ${tone.border};font-size:12px;line-height:18px;font-weight:700;color:${tone.accent};">${escapeHtml(badge)}</span></p>` : ""}
<h1 class="heading" style="margin:0;font-size:26px;line-height:32px;font-weight:700;color:#1a1a1a;">${escapeHtml(title)}</h1>
${intro ? `<p style="margin:12px 0 0;font-size:15px;line-height:23px;color:#4a4a4a;">${escapeHtml(intro)}</p>` : ""}
</td>
</tr>
${sections.map((section) => renderSection(section, tone)).join("\n")}
${renderAction(action, tone)}
<tr>
<td style="padding:32px 32px 0;" class="gutter">&nbsp;</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="padding:20px 8px 8px;font-size:12px;line-height:18px;color:#8a8a8a;">
${footerNote ? `<p style="margin:0 0 6px;">${escapeHtml(footerNote)}</p>` : ""}
<p style="margin:0;">${escapeHtml(legalContactLine())}</p>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`;
}
