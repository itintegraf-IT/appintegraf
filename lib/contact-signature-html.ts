/**
 * HTML podpis / vizitka — layout podle fyzické vizitky Integraf (90×50 mm).
 * Horní část: jméno + funkce vlevo, kruhové logo vpravo; uprostřed prázdný prostor;
 * spodní část: 3 řádky (firma/adresa | M/E/W) s 4 vodorovnými linkami.
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
/** Integraf červená — jméno i logo. */
const BRAND_RED = "#c41230";

const CARD_WIDTH_MM = 90;
const CARD_HEIGHT_MM = 50;

const FONT =
  "font-family:Arial,Helvetica,sans-serif;font-size:9px;line-height:1.25;color:#111111;";
/** Tištěná vizitka: bez podtržení odkazů. */
const LINK = "color:#111111;text-decoration:none;";
/** Linky spodní mřížky — tmavě šedé jako na tisku. */
const RULE = "1px solid #888888";
const CELL_PAD = "padding:2.2px 0;";

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

function contactCell(label: string, innerHtml: string): string {
  return `<strong>${escapeHtml(label)}</strong>&nbsp;${innerHtml}`;
}

export function buildOutlookContactSignatureHtml(data: ContactSignatureInput, assetBaseUrl: string): string {
  const name = `${data.firstName} ${data.lastName}`.trim();
  const pos = (data.position ?? "").trim();
  const email = (data.email ?? "").trim();
  const phone = (data.phone ?? "").trim();

  const nameHtml = escapeHtml(name);
  const logoSrc = assetBaseUrl ? `${assetBaseUrl.replace(/\/$/, "")}${LOGO_PATH}` : LOGO_PATH;

  const titleBlock = pos
    ? `<p style="margin:1px 0 0 0;font-size:9px;font-weight:normal;color:#111111;line-height:1.25;">${escapeHtml(pos)}</p>`
    : "";

  const phoneInner = phone
    ? contactCell("M", `<a href="${telHref(phone)}" style="${LINK}">${escapeHtml(phone)}</a>`)
    : "&nbsp;";
  const emailInner = email
    ? contactCell("E", `<a href="mailto:${escapeHtml(email)}" style="${LINK}">${escapeHtml(email)}</a>`)
    : "&nbsp;";
  const webInner = contactCell(
    "W",
    `<a href="${escapeHtml(WEB_URL)}" style="${LINK}" rel="noopener noreferrer">${escapeHtml(WEB_LABEL)}</a>`
  );

  const cardW = `${CARD_WIDTH_MM}mm`;
  const cardH = `${CARD_HEIGHT_MM}mm`;

  // Spodní mřížka: 3 řádky + linka nahoře i pod každým → 4 vodorovné linky (jako tisk).
  const bottomGrid = `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;border-collapse:collapse;${FONT}">
<tr>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-right:3mm;border-top:${RULE};border-bottom:${RULE};font-weight:bold;">${escapeHtml(COMPANY)}</td>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-left:3mm;border-top:${RULE};border-bottom:${RULE};">${phoneInner}</td>
</tr>
<tr>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-right:3mm;border-bottom:${RULE};">${escapeHtml(ADDRESS_STREET)}</td>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-left:3mm;border-bottom:${RULE};">${emailInner}</td>
</tr>
<tr>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-right:3mm;border-bottom:${RULE};">${escapeHtml(ADDRESS_CITY)}</td>
<td style="vertical-align:middle;width:50%;${CELL_PAD}padding-left:3mm;border-bottom:${RULE};">${webInner}</td>
</tr>
</table>`;

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:${cardW};height:${cardH};table-layout:fixed;border-collapse:collapse;background:#ffffff;${FONT}">
<tr>
<td style="vertical-align:top;padding:3.5mm 3.5mm 0 3.5mm;height:18mm;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;border-collapse:collapse;">
<tr>
<td style="vertical-align:top;text-align:left;width:62%;padding:0;">
<p style="margin:0;font-weight:bold;font-size:13px;line-height:1.15;color:${BRAND_RED};">${nameHtml}</p>
${titleBlock}
</td>
<td style="vertical-align:top;text-align:right;width:38%;padding:0 0 0 2mm;">
<img src="${escapeHtml(logoSrc)}" width="58" height="58" alt="Integraf" style="display:block;width:15.5mm;height:15.5mm;border:0;margin:0 0 0 auto;" />
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="vertical-align:bottom;padding:0 3.5mm 3.5mm 3.5mm;height:auto;">
${bottomGrid}
</td>
</tr>
</table>`;
}
