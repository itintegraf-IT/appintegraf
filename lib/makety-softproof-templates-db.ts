import { prisma } from "@/lib/db";
import {
  MAKETY_SOFTPROOF_TEMPLATES_KEY,
  MAKETY_SOFTPROOF_TEMPLATES_MODULE,
  parseSoftproofTemplatesJson,
  sanitizeSoftproofTemplate,
  type SoftproofTemplate,
} from "@/lib/makety-softproof-templates";

export async function loadSoftproofTemplates(): Promise<SoftproofTemplate[]> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: MAKETY_SOFTPROOF_TEMPLATES_KEY },
    select: { setting_value: true },
  });
  return parseSoftproofTemplatesJson(row?.setting_value);
}

export async function saveSoftproofTemplates(
  templates: SoftproofTemplate[],
  updatedBy?: number
): Promise<SoftproofTemplate[]> {
  const sanitized: SoftproofTemplate[] = [];
  const seen = new Set<string>();
  for (const item of templates) {
    const t = sanitizeSoftproofTemplate(item);
    if (!t || seen.has(t.locale)) continue;
    seen.add(t.locale);
    sanitized.push(t);
  }
  if (sanitized.length === 0) {
    throw new Error("Alespoň jedna jazyková šablona je povinná");
  }
  await prisma.system_settings.upsert({
    where: { setting_key: MAKETY_SOFTPROOF_TEMPLATES_KEY },
    create: {
      setting_key: MAKETY_SOFTPROOF_TEMPLATES_KEY,
      setting_value: JSON.stringify(sanitized),
      module: MAKETY_SOFTPROOF_TEMPLATES_MODULE,
      description: "Šablony e-mailu a veřejné stránky softproofu",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(sanitized),
      module: MAKETY_SOFTPROOF_TEMPLATES_MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });
  return sanitized;
}
