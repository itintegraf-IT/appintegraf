/**
 * HTML podpis / vizitka Integraf — dvě varianty pro Outlook Desktop.
 * - vizitka: fyzická vizitka 90×50 mm (jméno vlevo, logo vpravo nahoře, mřížka dole)
 * - podpis: e-mailový podpis (jméno nahoře, logo vlevo u adresy/kontaktů)
 */

import { headers } from "next/headers";

export type ContactSignatureInput = {
  firstName: string;
  lastName: string;
  position: string | null;
  email: string;
  phone: string | null;
};

export type SignatureVariant = "vizitka" | "podpis";

const COMPANY = "Integraf, s.r.o.";
const ADDRESS_STREET = "Myslbekova 273";
const ADDRESS_CITY = "547 01 Náchod";
const WEB_URL = "https://www.integraf.cz";
const WEB_LABEL = "www.integraf.cz";
const LOGO_PATH = "/vizitka-integraf-logo.png";
const BRAND_RED = "#c41230";

const FONT =
  "font-family:Arial,Helvetica,sans-serif;font-size:8.5px;line-height:1.2;color:#111111;";
const LINK = "color:#111111;text-decoration:none;";
const RULE = "1px solid #b0b0b0";

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
  return `<strong style="font-weight:bold;">${escapeHtml(label)}</strong>&nbsp;${innerHtml}`;
}

function logoSrc(assetBaseUrl: string): string {
  return assetBaseUrl ? `${assetBaseUrl.replace(/\/$/, "")}${LOGO_PATH}` : LOGO_PATH;
}

function prepareFields(data: ContactSignatureInput, assetBaseUrl: string) {
  const name = `${data.firstName} ${data.lastName}`.trim();
  const pos = (data.position ?? "").trim();
  const email = (data.email ?? "").trim();
  const phone = (data.phone ?? "").trim();
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
  return {
    nameHtml: escapeHtml(name),
    titleHtml: pos
      ? `<div style="margin:2px 0 0 0;font-size:8.5px;font-weight:normal;color:#111111;line-height:1.2;">${escapeHtml(pos)}</div>`
      : "",
    phoneInner,
    emailInner,
    webInner,
    logo: escapeHtml(logoSrc(assetBaseUrl)),
  };
}

function addressContactGrid(
  phoneInner: string,
  emailInner: string,
  webInner: string,
  opts?: { leftPad?: string; rightPad?: string }
): string {
  const lp = opts?.leftPad ?? "2.5mm";
  const rp = opts?.rightPad ?? "2.5mm";
  const leftCell = (content: string, extraBorder: string, bold = false) =>
    `<td style="vertical-align:middle;width:48%;padding:1.5px ${rp} 1.5px 0;border-bottom:${RULE};${extraBorder}${bold ? "font-weight:bold;" : ""}">${content}</td>`;
  const rightCell = (content: string, extraBorder: string) =>
    `<td style="vertical-align:middle;width:52%;padding:1.5px 0 1.5px ${lp};border-bottom:${RULE};${extraBorder}">${content}</td>`;
  const topBorder = `border-top:${RULE};`;

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;border-collapse:collapse;${FONT}">
<tr>
${leftCell(escapeHtml(COMPANY), topBorder, true)}
${rightCell(phoneInner, topBorder)}
</tr>
<tr>
${leftCell(escapeHtml(ADDRESS_STREET), "")}
${rightCell(emailInner, "")}
</tr>
<tr>
${leftCell(escapeHtml(ADDRESS_CITY), "")}
${rightCell(webInner, "")}
</tr>
</table>`;
}

/** Fyzická vizitka 90×50 mm — logo vpravo nahoře. */
export function buildVizitkaSignatureHtml(data: ContactSignatureInput, assetBaseUrl: string): string {
  const { nameHtml, titleHtml, phoneInner, emailInner, webInner, logo } = prepareFields(
    data,
    assetBaseUrl
  );
  const grid = addressContactGrid(phoneInner, emailInner, webInner);

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="90" height="50" style="width:90mm;height:50mm;max-width:90mm;table-layout:fixed;border-collapse:collapse;background:#ffffff;${FONT}">
<tr>
<td style="vertical-align:top;padding:4mm 4mm 0 4mm;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" width="100%" style="width:100%;border-collapse:collapse;">
<tr>
<td style="vertical-align:top;text-align:left;width:58%;padding:0;">
<div style="margin:0;font-weight:bold;font-size:12px;line-height:1.15;color:${BRAND_RED};">${nameHtml}</div>
${titleHtml}
</td>
<td style="vertical-align:top;text-align:right;width:42%;padding:0;">
<img src="${logo}" width="52" height="52" alt="Integraf" style="display:block;width:14mm;height:14mm;border:0;margin:0 0 0 auto;" />
</td>
</tr>
</table>
</td>
</tr>
<tr>
<td style="vertical-align:bottom;padding:8mm 4mm 3.5mm 4mm;">
${grid}
</td>
</tr>
</table>`;
}

/** E-mailový podpis — jméno nahoře, logo vlevo u adresy a kontaktů. */
export function buildPodpisSignatureHtml(data: ContactSignatureInput, assetBaseUrl: string): string {
  const { nameHtml, titleHtml, phoneInner, emailInner, webInner, logo } = prepareFields(
    data,
    assetBaseUrl
  );
  const grid = addressContactGrid(phoneInner, emailInner, webInner, {
    leftPad: "3mm",
    rightPad: "3mm",
  });

  return `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;background:#ffffff;${FONT}">
<tr>
<td style="vertical-align:top;padding:0 0 4mm 0;">
<div style="margin:0;font-weight:bold;font-size:14px;line-height:1.15;color:${BRAND_RED};">${nameHtml}</div>
${titleHtml}
</td>
</tr>
<tr>
<td style="vertical-align:top;padding:0;">
<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">
<tr>
<td style="vertical-align:middle;padding:0 4mm 0 0;">
<img src="${logo}" width="64" height="64" alt="Integraf" style="display:block;width:17mm;height:17mm;border:0;" />
</td>
<td style="vertical-align:middle;padding:0;min-width:58mm;">
${grid}
</td>
</tr>
</table>
</td>
</tr>
</table>`;
}

/** @deprecated Použijte buildVizitkaSignatureHtml — zachováno pro kompatibilitu. */
export function buildOutlookContactSignatureHtml(
  data: ContactSignatureInput,
  assetBaseUrl: string
): string {
  return buildVizitkaSignatureHtml(data, assetBaseUrl);
}

export function buildBothSignatureHtmls(
  data: ContactSignatureInput,
  assetBaseUrl: string
): { vizitkaHtml: string; podpisHtml: string } {
  return {
    vizitkaHtml: buildVizitkaSignatureHtml(data, assetBaseUrl),
    podpisHtml: buildPodpisSignatureHtml(data, assetBaseUrl),
  };
}
