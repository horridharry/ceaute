// Shared HTML for Ceaute transactional email, matching the approved templates
// in ceaute-email-templates/. Email clients ignore most modern CSS, so this is
// nested tables with inline styles; the <style> block is only the one mobile
// breakpoint at 620px.
//
// The palette is the design system's, not the old pink one: plum #8c2b52 on
// ink #0b0b0b, card #ffffff on page #f0eee9. There is no dark-mode inversion —
// the templates declare `color-scheme: light only` for the same reason
// globals.css pins the app to light.
//
// Every dynamic value passes through escapeHtml here, so callers hand over
// plain strings. Blocks come from booking-email-content.js as data, which is
// what keeps the HTML and the plain-text alternative carrying the same facts.

export const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export const COLORS = {
  page: "#f0eee9",
  card: "#ffffff",
  cardBorder: "#e4e2df",
  rule: "#e4e2df",
  buttonBorder: "#d0cecb",
  ink: "#0b0b0b",
  plum: "#8c2b52",
  muted: "#5c5c5c",
  faint: "#6e6e6e",
  ok: "#2f6f4f",
  pending: "#c98a1a",
  bad: "#b3261e",
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

// The zero-width spaces stop Gmail appending the start of the card to the
// preheader in the inbox list.
const PREHEADER_PAD = "&#8203;".repeat(20);

function rule(margin) {
  return `<div style="height:1px;line-height:1px;font-size:0;background:${COLORS.rule};margin:${margin}">&nbsp;</div>`;
}

function headline(text) {
  return `<div class="h1" style="font:600 30px/1.14 ${FONT};letter-spacing:-.8px;color:${COLORS.ink};max-width:440px">${escapeHtml(text)}</div>`;
}

function lede(text) {
  return `<div style="padding-top:14px;font:400 15px/1.65 ${FONT};color:${COLORS.muted}">${escapeHtml(text)}</div>`;
}

// The date over a 46px time, with "until … · duration" set beside its baseline.
function when({ dayLong, startTime, endTime, duration }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:26px">
<tr>
<td valign="bottom" style="padding:0">
<div style="font:500 15px ${FONT};color:${COLORS.muted}">${escapeHtml(dayLong)}</div>
<div class="time" style="padding-top:2px;font:600 46px/1 ${FONT};letter-spacing:-1.6px;color:${COLORS.ink}">${escapeHtml(startTime)}</div>
</td>
<td valign="bottom" style="padding:0 0 6px 20px;font:400 14px ${FONT};color:${COLORS.faint};white-space:nowrap">until ${escapeHtml(endTime)} · ${escapeHtml(duration)}</td>
</tr></table>`;
}

function line(text) {
  return `<div style="padding-top:22px;font:400 15px/1.6 ${FONT};color:${COLORS.ink}">${escapeHtml(text)}</div>`;
}

function address({ single, access }) {
  const accessLine = access
    ? `<div style="padding-top:4px;font:400 14px/1.6 ${FONT};color:${COLORS.muted}">${escapeMultiline(access)}</div>`
    : "";

  return `<div style="font:400 15px/1.6 ${FONT};color:${COLORS.ink}">${escapeHtml(single)}</div>${accessLine}`;
}

// Only ever rendered into a provider email — see booking-email-content.js.
function contact({ name, phone, phoneE164, email }) {
  const parts = [];

  if (phone) {
    const href = phoneE164 ? `tel:${encodeURIComponent(phoneE164)}` : "";
    parts.push(
      href
        ? `<a href="${escapeHtml(href)}" style="color:${COLORS.plum};text-decoration:none">${escapeHtml(phone)}</a>`
        : escapeHtml(phone),
    );
  }

  if (email) {
    parts.push(
      `<a href="mailto:${escapeHtml(encodeURIComponent(email))}" style="color:${COLORS.plum};text-decoration:none">${escapeHtml(email)}</a>`,
    );
  }

  const second = parts.length
    ? `<br>${parts.join(" · ")}`
    : "";

  return `<div style="font:400 15px/1.7 ${FONT};color:${COLORS.ink}">${escapeHtml(name)}${second}</div>`;
}

// A dot and a word, the same grammar the app uses for status. Never a pill.
function status({ tone, title, detail }) {
  const dot = COLORS[tone] ?? COLORS.pending;

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
<td width="20" valign="top" style="padding:6px 11px 0 0"><div style="width:9px;height:9px;line-height:9px;font-size:0;border-radius:50%;background:${dot}">&nbsp;</div></td>
<td valign="top">
<div style="font:500 15px ${FONT};color:${COLORS.ink}">${escapeHtml(title)}</div>
<div style="padding-top:3px;font:400 14px/1.6 ${FONT};color:${COLORS.muted}">${escapeHtml(detail)}</div>
</td></tr></table>`;
}

function meta(text) {
  return `<div style="font:400 14px/1.7 ${FONT};color:${COLORS.muted}">${escapeHtml(text)}</div>`;
}

function money({ strong, muted: mutedText }) {
  const second = mutedText ? `<br>${escapeHtml(mutedText)}` : "";

  return `<div style="font:400 14px/1.7 ${FONT};color:${COLORS.muted}"><span style="color:${COLORS.ink};font-weight:500">${escapeHtml(strong)}</span>${second}</div>`;
}

// Padded anchors in table cells so the buttons keep their shape in Outlook.
// A link with no URL is dropped rather than rendered dead.
function actions(items) {
  const usable = items.filter((item) => item?.url && item?.label);

  if (!usable.length) {
    return "";
  }

  const cells = usable
    .map((item, index) => {
      const last = index === usable.length - 1;
      const padding = last ? "0" : "0 10px 0 0";
      const skin =
        item.variant === "primary"
          ? `background:${COLORS.plum};color:${COLORS.card};padding:13px 24px`
          : `border:1px solid ${COLORS.buttonBorder};color:${COLORS.ink};padding:12px 24px`;

      return `<td class="btn-cell" style="padding:${padding}">
<a class="btn" href="${escapeHtml(item.url)}" style="display:inline-block;${skin};border-radius:10px;font:600 15px ${FONT};text-decoration:none;text-align:center">${escapeHtml(item.label)}</a>
</td>`;
    })
    .join("\n");

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px"><tr>
${cells}
</tr></table>`;
}

const RENDERERS = {
  headline: (block) => headline(block.text),
  lede: (block) => lede(block.text),
  when,
  rule: (block) => rule(block.margin ?? "22px 0"),
  line: (block) => line(block.text),
  address,
  contact,
  status,
  meta: (block) => meta(block.text),
  money,
  actions: (block) => actions(block.items),
};

export function renderEmailBlocks(blocks) {
  return blocks
    .map((block) => RENDERERS[block.kind]?.(block) ?? "")
    .filter(Boolean)
    .join("\n");
}

export function renderEmailShell({ title, preheader, blocks, footerUrl, footerUrlDisplay }) {
  const footerLink = footerUrl
    ? `<a href="${escapeHtml(footerUrl)}" style="color:${COLORS.faint};text-decoration:none">${escapeHtml(footerUrlDisplay || footerUrl)}</a><br>`
    : "";

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${escapeHtml(title)}</title>
<!--[if mso]><style>body,table,td{font-family:Arial,Helvetica,sans-serif !important}</style><![endif]-->
<style>
  @media (max-width:620px){
    .card{padding:24px !important}
    .h1{font-size:25px !important}
    .time{font-size:38px !important}
    .btn{display:block !important;width:100% !important;box-sizing:border-box}
    .btn-cell{display:block !important;width:100% !important;padding:0 0 8px 0 !important}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${COLORS.page};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}${PREHEADER_PAD}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.page}">
<tr><td align="center" style="padding:24px 12px 40px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%">

<tr><td style="padding:0 8px 14px;font:600 12px ${FONT};letter-spacing:.2em;text-transform:uppercase;color:${COLORS.plum}">ceaute</td></tr>

<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${COLORS.card};border:1px solid ${COLORS.cardBorder};border-radius:14px">
<tr><td class="card" style="padding:36px">
${renderEmailBlocks(blocks)}
</td></tr>
</table>
</td></tr>

<tr><td style="padding:18px 8px 2px;font:400 12px/1.6 ${FONT};color:${COLORS.faint}">${footerLink}You are receiving this email because of a booking made through Ceaute.</td></tr>

</table>
</td></tr></table>
</body></html>`;
}
