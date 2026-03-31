/**
 * HTML podpis / vizitka — layout podle fyzické vizitky Integraf (90×50 mm).
 * Horní část: jméno + funkce vlevo, logo vpravo; spodní část: firma vlevo, kontakty vpravo, řádky oddělené šedými linkami.
 */

import { headers } from "next/headers";

export type ContactSignatureInput = {
  firstName: string;
  lastName: string;
  position: string | null;
  email: string;
  phone: string | null;
};

const COMPANY = "Integraf, s.r.o.";
const ADDRESS_STREET = "Myslbekova 273";
const ADDRESS_CITY = "547 01 Náchod";
const WEB_URL = "https://www.integraf.cz";
const WEB_LABEL = "www.integraf.cz";
const LOGO_PATH = "/vizitka-integraf-logo.png";

const CARD_WIDTH_MM = 90;
const CARD_HEIGHT_MM = 50;

/** Vodorovné oddělovače řádků ve spodní části (jako na tiskové vizitce). */
const ROW_RULE = "border-bottom:1px solid #cccccc;padding-bottom:3px;margin-bottom:3px;";
const FONT =
  "font-family:'Segoe UI',Arial,Helvetica,sans-serif;font-size:10px;line-height:1.35;color:#111111;";
const LINK = "color:#111111;text-decoration:underline;";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Pro <img src> v podpisu (Outlook potřebuje absolutní URL mimo prohlížeč). */
export async function getContactSignatureAssetBaseUrl(): Promise<string> {
  const env = (process.env.AUTH_URL || process.env.APP_URL || "").replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "";
  if (!host) return env;
  const forwardedProto = h.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto =
    forwardedProto === "https" || forwardedProto === "http"
      ? forwardedProto
      : host.startsWith("localhost") || host.startsWith("127.")
        ? "http"
        : "https";
  return `${proto}://${host}`;
}

function telHref(phone: string): string {
  const compact = phone.replace(/[\s\u00a0]/g, "");
  if (!compact) return "#";
  return "tel:" + encodeURIComponent(compact);
}

export function buildOutlookContactSignatureHtml(data: ContactSignatureInput, assetBaseUrl: string): string {
  const name = `${data.firstName} ${data.lastName}`.trim();
  const pos = (data.position ?? "").trim();
  const email = (data.email ?? "").trim();
  const phone = (data.phone ?? "").trim();

  const nameHtml = escapeHtml(name);
  const emailEsc = escapeHtml(email);
  const phoneEsc = escapeHtml(phone);
  const logoSrc = assetBaseUrl ? `${assetBaseUrl.replace(/\/$/, "")}${LOGO_PATH}` : LOGO_PATH;

  const titleBlock = pos
    ? `<p style="margin:0.2em 0 0 0;font-size:10px;font-weight:normal;color:#111111;">${escapeHtml(pos)}</p>`
    : "";

  const phoneRow = phone
    ? `<div style="${ROW_RULE}text-align:right;"><strong>M</strong>&nbsp;<a href="${telHref(phone)}" style="${LINK}">${phoneEsc}</a></div>`
    : "";

  const emailRow = email
    ? `<div style="${ROW_RULE}text-align:right;"><strong>E</strong>&nbsp;<a href="mailto:${encodeURIComponent(email)}" style="${LINK}">${emailEsc}</a></div>`
    : "";

  const webRow = `<div style="${ROW_RULE}text-align:right;margin-bottom:0;"><strong>W</strong>&nbsp;<a href="${escapeHtml(WEB_URL)}" style="${LINK}" rel="noopener noreferrer">${escapeHtml(WEB_LABEL)}</a></div>`;

  const cardW = `${CARD_WIDTH_MM}mm`;
  const cardH = `${CARD_HEIGHT_MM}mm`;

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:${cardW};height:${cardH};table-layout:fixed;border-collapse:collapse;${FONT}">
<tr>
<td style="vertical-align:top;text-align:left;padding:3mm 2mm 2mm 3mm;width:55%;">
<p style="margin:0;font-weight:bold;font-size:11px;line-height:1.2;color:#c41230;">${nameHtml}</p>
${titleBlock}
</td>
<td style="vertical-align:top;text-align:right;padding:3mm 3mm 2mm 2mm;width:45%;">
<img src="${escapeHtml(logoSrc)}" alt="Integraf — logo" style="display:block;max-width:100%;max-height:20mm;width:auto;height:auto;border:0;margin:0 0 0 auto;" />
</td>
</tr>
<tr>
<td colspan="2" style="vertical-align:top;padding:0 3mm 3mm 3mm;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;border-collapse:collapse;${FONT}">
<tr>
<td style="vertical-align:top;width:50%;padding-right:2.5mm;">
<div style="${ROW_RULE}font-weight:bold;">${escapeHtml(COMPANY)}</div>
<div style="${ROW_RULE}">${escapeHtml(ADDRESS_STREET)}</div>
<div style="${ROW_RULE}margin-bottom:0;">${escapeHtml(ADDRESS_CITY)}</div>
</td>
<td style="vertical-align:top;width:50%;padding-left:2.5mm;">
${phoneRow}
${emailRow}
${webRow}
</td>
</tr>
</table>
</td>
</tr>
</table>`;
}
