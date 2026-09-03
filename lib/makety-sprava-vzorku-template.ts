export const MAKETY_SPRAVA_VZORKU_NOTIFY_KEY = "makety_sprava_vzorku_notify";
export const MAKETY_SPRAVA_VZORKU_NOTIFY_MODULE = "makety";

export type SpravaVzorkuTemplateVars = {
  toName?: string;
  orderNumber?: string | null;
  labelCode?: string | null;
  productName?: string | null;
  jobNumber?: string | null;
  maketaId?: number | string | null;
};

export type SpravaVzorkuNotifyTemplate = {
  subject: string;
  title: string;
  intro: string;
  ctaLabel: string;
};

export const DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE: SpravaVzorkuNotifyTemplate = {
  subject: "Likvidace nátisku / zásob – {{orderNumber}}",
  title: "Likvidace nátisku / zásob",
  intro: "Prosím o likvidaci nátisku a skladových zásob",
  ctaLabel: "Otevřít grafiku",
};

const TEMPLATE_FIELDS: Array<keyof SpravaVzorkuNotifyTemplate> = [
  "subject",
  "title",
  "intro",
  "ctaLabel",
];

export const SPRAVA_VZORKU_PLACEHOLDER_HINT =
  "{{orderNumber}}, {{labelCode}}, {{productName}}, {{jobNumber}}, {{maketaId}}, {{toName}}";

function asTrimmedString(value: unknown, maxLen: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLen);
}

export function sanitizeSpravaVzorkuNotifyTemplate(
  raw: unknown
): SpravaVzorkuNotifyTemplate | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const subject = asTrimmedString(obj.subject, 200);
  const title = asTrimmedString(obj.title, 200);
  const intro = asTrimmedString(obj.intro, 2000);
  const ctaLabel = asTrimmedString(obj.ctaLabel, 100);
  if (!subject || !title || !intro) return null;
  return {
    subject,
    title,
    intro,
    ctaLabel: ctaLabel || DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE.ctaLabel,
  };
}

export function parseSpravaVzorkuNotifyTemplateJson(
  raw: string | null | undefined
): SpravaVzorkuNotifyTemplate {
  if (!raw?.trim()) return { ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE };
  try {
    const parsed = JSON.parse(raw) as unknown;
    const sanitized = sanitizeSpravaVzorkuNotifyTemplate(parsed);
    return sanitized ?? { ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE };
  } catch {
    return { ...DEFAULT_SPRAVA_VZORKU_NOTIFY_TEMPLATE };
  }
}

export function applySpravaVzorkuPlaceholders(
  text: string,
  vars: SpravaVzorkuTemplateVars
): string {
  const orderNumber =
    (vars.orderNumber && vars.orderNumber.trim()) ||
    (vars.maketaId != null ? `grafika #${vars.maketaId}` : "");
  const map: Record<string, string> = {
    toName: vars.toName?.trim() || "",
    orderNumber,
    labelCode: vars.labelCode?.trim() || "",
    productName: vars.productName?.trim() || "",
    jobNumber: vars.jobNumber?.trim() || "",
    maketaId: vars.maketaId != null ? String(vars.maketaId) : "",
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? "");
}

export function renderSpravaVzorkuNotifyTemplate(
  template: SpravaVzorkuNotifyTemplate,
  vars: SpravaVzorkuTemplateVars
): SpravaVzorkuNotifyTemplate {
  const rendered = { ...template };
  for (const key of TEMPLATE_FIELDS) {
    rendered[key] = applySpravaVzorkuPlaceholders(String(template[key]), vars);
  }
  return rendered;
}
