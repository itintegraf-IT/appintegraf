export const MAKETY_SOFTPROOF_TEMPLATES_KEY = "makety_softproof_templates";
export const MAKETY_SOFTPROOF_TEMPLATES_MODULE = "makety";

export type SoftproofTemplateVars = {
  toName?: string;
  orderNumber?: string | null;
  labelCode?: string | null;
  fileName?: string | null;
  pageUrl?: string | null;
  maketaId?: number | string | null;
};

export type SoftproofTemplate = {
  locale: string;
  label: string;
  isActive: boolean;
  subject: string;
  greeting: string;
  intro: string;
  legalHtml: string;
  ctaLabel: string;
  validityNote: string;
  footer: string;
  pageTitle: string;
  pageHint: string;
  downloadLabel: string;
  approveLabel: string;
  rejectLabel: string;
  rejectReasonLabel: string;
  usedMessage: string;
  expiredMessage: string;
};

const TEMPLATE_FIELDS: Array<keyof SoftproofTemplate> = [
  "locale",
  "label",
  "isActive",
  "subject",
  "greeting",
  "intro",
  "legalHtml",
  "ctaLabel",
  "validityNote",
  "footer",
  "pageTitle",
  "pageHint",
  "downloadLabel",
  "approveLabel",
  "rejectLabel",
  "rejectReasonLabel",
  "usedMessage",
  "expiredMessage",
];

export const DEFAULT_SOFTPROOF_TEMPLATES: SoftproofTemplate[] = [
  {
    locale: "cs",
    label: "Čeština",
    isActive: true,
    subject: "Softproof ke schválení – {{orderNumber}}",
    greeting: "Dobrý den, {{toName}},",
    intro: "zasíláme Vám softproof grafiky ke schválení.",
    legalHtml:
      "Tisková data byla upravena dle Vašich požadavků a interních specifikací tisku. Prosíme o kontrolu správnosti textů, grafických prvků a dalších údajů.\n\nSchválením přebíráte plnou odpovědnost za obsah tiskových dat; pozdější reklamace chyb v obsahu nelze uplatnit. Schválením zároveň stvrzujete souhlas s obchodními podmínkami společnosti INTEGRAF (https://www.integraf.cz/ke-stazeni).\n\nPo kontrole náhledu na odkazu zvolte Schválit, nebo Zamítnout a uveďte, co je potřeba upravit.",
    ctaLabel: "Otevřít náhled",
    validityNote: "Odkaz je platný 7 dní a po schválení nebo zamítnutí se zneplatní. Pokud tlačítko nefunguje, zkopírujte: {{pageUrl}}",
    footer: "Tento e-mail byl odeslán automaticky z aplikace INTEGRAF.",
    pageTitle: "Softproof ke schválení",
    pageHint: "Zkontrolujte náhled, případně stáhněte plný softproof. Poté zakázku schvalte, nebo zamítněte s důvodem.",
    downloadLabel: "Stáhnout softproof",
    approveLabel: "Schválit",
    rejectLabel: "Zamítnout",
    rejectReasonLabel: "Důvod zamítnutí (co je špatně)",
    usedMessage: "Tento odkaz již byl použit (schválení nebo zamítnutí) a nelze ho znovu otevřít.",
    expiredMessage: "Odkaz vypršel nebo již není platný. Požádejte INTEGRAF o nový softproof.",
  },
  {
    locale: "en",
    label: "English",
    isActive: true,
    subject: "Softproof for approval – {{orderNumber}}",
    greeting: "Hello {{toName}},",
    intro: "please find the graphic softproof for your approval.",
    legalHtml:
      "The print data have been prepared according to your requirements and our print specifications. Please check the texts, graphic elements and other details.\n\nBy approving you accept full responsibility for the content; later claims regarding content errors cannot be accepted. Approval also confirms that you agree with INTEGRAF terms and conditions (https://www.integraf.cz/ke-stazeni).\n\nAfter reviewing the preview, choose Approve, or Reject and describe what needs to be changed.",
    ctaLabel: "Open preview",
    validityNote: "The link is valid for 7 days and becomes invalid after approval or rejection. If the button does not work, copy: {{pageUrl}}",
    footer: "This e-mail was sent automatically from the INTEGRAF application.",
    pageTitle: "Softproof for approval",
    pageHint: "Review the preview or download the full softproof, then approve or reject with a reason.",
    downloadLabel: "Download softproof",
    approveLabel: "Approve",
    rejectLabel: "Reject",
    rejectReasonLabel: "Rejection reason (what is wrong)",
    usedMessage: "This link has already been used (approved or rejected) and cannot be opened again.",
    expiredMessage: "The link has expired or is no longer valid. Please ask INTEGRAF for a new softproof.",
  },
  {
    locale: "de",
    label: "Deutsch",
    isActive: true,
    subject: "Softproof zur Freigabe – {{orderNumber}}",
    greeting: "Guten Tag {{toName}},",
    intro: "wir senden Ihnen den Softproof der Grafik zur Freigabe.",
    legalHtml:
      "Die Druckdaten wurden gemäß Ihren Anforderungen und unseren Druckspezifikationen erstellt. Bitte prüfen Sie Texte, grafische Elemente und weitere Angaben.\n\nMit der Freigabe übernehmen Sie die volle Verantwortung für den Inhalt; spätere Reklamationen wegen Inhaltsfehlern sind ausgeschlossen. Die Freigabe bestätigt zugleich die Zustimmung zu den AGB von INTEGRAF (https://www.integraf.cz/ke-stazeni).\n\nNach der Kontrolle wählen Sie Freigeben oder Ablehnen und beschreiben Sie, was zu ändern ist.",
    ctaLabel: "Vorschau öffnen",
    validityNote: "Der Link ist 7 Tage gültig und wird nach Freigabe oder Ablehnung ungültig. Falls die Schaltfläche nicht funktioniert, kopieren Sie: {{pageUrl}}",
    footer: "Diese E-Mail wurde automatisch von der Anwendung INTEGRAF gesendet.",
    pageTitle: "Softproof zur Freigabe",
    pageHint: "Prüfen Sie die Vorschau oder laden Sie den vollständigen Softproof herunter. Anschließend freigeben oder mit Begründung ablehnen.",
    downloadLabel: "Softproof herunterladen",
    approveLabel: "Freigeben",
    rejectLabel: "Ablehnen",
    rejectReasonLabel: "Ablehnungsgrund (was ist falsch)",
    usedMessage: "Dieser Link wurde bereits verwendet (Freigabe oder Ablehnung) und kann nicht erneut geöffnet werden.",
    expiredMessage: "Der Link ist abgelaufen oder nicht mehr gültig. Bitte fordern Sie bei INTEGRAF einen neuen Softproof an.",
  },
];

export function normalizeSoftproofLocale(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 8);
}

export function applySoftproofPlaceholders(text: string, vars: SoftproofTemplateVars): string {
  const orderNumber =
    (vars.orderNumber && vars.orderNumber.trim()) ||
    (vars.maketaId != null ? `grafika #${vars.maketaId}` : "");
  const map: Record<string, string> = {
    toName: vars.toName?.trim() || "",
    orderNumber,
    labelCode: vars.labelCode?.trim() || "",
    fileName: vars.fileName?.trim() || "",
    pageUrl: vars.pageUrl?.trim() || "",
    maketaId: vars.maketaId != null ? String(vars.maketaId) : "",
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? "");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function softproofTextToEmailHtml(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return `<p style="margin:0; white-space: pre-wrap;">${escapeHtml(trimmed).replace(/\n/g, "<br>")}</p>`;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

export function sanitizeSoftproofTemplate(
  raw: unknown,
  fallback?: SoftproofTemplate
): SoftproofTemplate | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const locale = normalizeSoftproofLocale(asString(row.locale, fallback?.locale ?? ""));
  if (!locale) return null;
  const base = fallback ?? DEFAULT_SOFTPROOF_TEMPLATES.find((t) => t.locale === locale);
  const empty: SoftproofTemplate = {
    locale,
    label: locale.toUpperCase(),
    isActive: true,
    subject: "",
    greeting: "",
    intro: "",
    legalHtml: "",
    ctaLabel: "",
    validityNote: "",
    footer: "",
    pageTitle: "",
    pageHint: "",
    downloadLabel: "",
    approveLabel: "",
    rejectLabel: "",
    rejectReasonLabel: "",
    usedMessage: "",
    expiredMessage: "",
  };
  const src = base ?? empty;
  return {
    locale,
    label: asString(row.label, src.label).trim() || src.label,
    isActive: row.isActive === false ? false : true,
    subject: asString(row.subject, src.subject),
    greeting: asString(row.greeting, src.greeting),
    intro: asString(row.intro, src.intro),
    legalHtml: asString(row.legalHtml, src.legalHtml),
    ctaLabel: asString(row.ctaLabel, src.ctaLabel),
    validityNote: asString(row.validityNote, src.validityNote),
    footer: asString(row.footer, src.footer),
    pageTitle: asString(row.pageTitle, src.pageTitle),
    pageHint: asString(row.pageHint, src.pageHint),
    downloadLabel: asString(row.downloadLabel, src.downloadLabel),
    approveLabel: asString(row.approveLabel, src.approveLabel),
    rejectLabel: asString(row.rejectLabel, src.rejectLabel),
    rejectReasonLabel: asString(row.rejectReasonLabel, src.rejectReasonLabel),
    usedMessage: asString(row.usedMessage, src.usedMessage),
    expiredMessage: asString(row.expiredMessage, src.expiredMessage),
  };
}

export function parseSoftproofTemplatesJson(raw: string | null | undefined): SoftproofTemplate[] {
  if (!raw?.trim()) return DEFAULT_SOFTPROOF_TEMPLATES.map((t) => ({ ...t }));
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return DEFAULT_SOFTPROOF_TEMPLATES.map((t) => ({ ...t }));
    const out: SoftproofTemplate[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      const t = sanitizeSoftproofTemplate(item);
      if (!t || seen.has(t.locale)) continue;
      seen.add(t.locale);
      out.push(t);
    }
    return out.length > 0 ? out : DEFAULT_SOFTPROOF_TEMPLATES.map((t) => ({ ...t }));
  } catch {
    return DEFAULT_SOFTPROOF_TEMPLATES.map((t) => ({ ...t }));
  }
}

export function getSoftproofTemplate(
  templates: SoftproofTemplate[],
  locale: string | null | undefined
): SoftproofTemplate {
  const wanted = normalizeSoftproofLocale(locale ?? "");
  const active = templates.filter((t) => t.isActive);
  const pool = active.length > 0 ? active : templates;
  return (
    pool.find((t) => t.locale === wanted) ??
    pool.find((t) => t.locale === "cs") ??
    pool[0] ??
    DEFAULT_SOFTPROOF_TEMPLATES[0]!
  );
}

export function renderSoftproofTemplate(
  template: SoftproofTemplate,
  vars: SoftproofTemplateVars
): SoftproofTemplate {
  const rendered = { ...template };
  for (const key of TEMPLATE_FIELDS) {
    if (key === "locale" || key === "label" || key === "isActive") continue;
    rendered[key] = applySoftproofPlaceholders(String(template[key]), vars) as never;
  }
  return rendered;
}

export function buildSoftproofEmailHtml(params: {
  template: SoftproofTemplate;
  vars: SoftproofTemplateVars;
  extraMessage?: string;
}): { subject: string; html: string; text: string } {
  const t = renderSoftproofTemplate(params.template, params.vars);
  const zak = params.vars.orderNumber?.trim()
    ? `<p><strong>${escapeHtml(t.locale === "de" ? "Auftrag" : t.locale === "en" ? "Order" : "Zakázka")}:</strong> ${escapeHtml(params.vars.orderNumber.trim())}</p>`
    : "";
  const label = params.vars.labelCode?.trim()
    ? `<p><strong>${escapeHtml(t.locale === "de" ? "Etikettencode" : t.locale === "en" ? "Label code" : "Kód etikety")}:</strong> ${escapeHtml(params.vars.labelCode.trim())}</p>`
    : "";
  const extra = params.extraMessage?.trim()
    ? `<div style="margin: 16px 0; padding: 12px; background: #f8fafc; border-left: 3px solid #2563eb;">${softproofTextToEmailHtml(params.extraMessage.trim())}</div>`
    : "";
  const legal = t.legalHtml.trim()
    ? `<div style="margin: 16px 0; padding: 12px; background: #eff6ff; border-left: 3px solid #2563eb;">${softproofTextToEmailHtml(t.legalHtml)}</div>`
    : "";
  const pageUrl = params.vars.pageUrl?.trim() || "";
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.5; color: #333;">
  <p>${escapeHtml(t.greeting)}</p>
  <p>${escapeHtml(t.intro)}</p>
  ${zak}
  ${label}
  ${extra}
  ${legal}
  ${params.vars.fileName ? `<p><strong>${escapeHtml(t.locale === "de" ? "Datei" : t.locale === "en" ? "File" : "Soubor")}:</strong> ${escapeHtml(params.vars.fileName)}</p>` : ""}
  <p><a href="${escapeHtml(pageUrl)}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">${escapeHtml(t.ctaLabel)}</a></p>
  <p style="color: #666; font-size: 12px;">${escapeHtml(t.validityNote)}</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 11px;">${escapeHtml(t.footer)}</p>
</body>
</html>
  `.trim();

  const text = [
    t.greeting,
    t.intro,
    params.vars.orderNumber ? `Order: ${params.vars.orderNumber}` : "",
    params.vars.labelCode ? `Label: ${params.vars.labelCode}` : "",
    params.extraMessage?.trim() || "",
    t.legalHtml,
    params.vars.fileName ? `File: ${params.vars.fileName}` : "",
    pageUrl,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { subject: t.subject.trim() || "Softproof", html, text };
}
