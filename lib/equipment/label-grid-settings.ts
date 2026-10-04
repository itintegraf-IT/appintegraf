import { prisma } from "@/lib/db";
import {
  DEFAULT_EQUIPMENT_LABEL_TEMPLATE,
  EQUIPMENT_LABEL_TEMPLATES,
  getTemplateSpec,
  normalizeEquipmentLabelGridSpec,
  resolveEquipmentLabelTemplate,
  type EquipmentLabelGridSpec,
  type EquipmentLabelTemplateKey,
} from "@/lib/equipment/label-layout";
import { DEFAULT_LABEL_OWNER_TEXT, normalizeLabelOwnerText } from "@/lib/equipment/label-text";

export const EQUIPMENT_LABEL_GRID_KEY = "equipment_label_grid";
const MODULE = "equipment";

export type EquipmentLabelGridSettings = {
  templateKey: EquipmentLabelTemplateKey;
  /** Pokud true, použije se `customSpec` místo vestavěné šablony. */
  useCustom: boolean;
  customSpec: EquipmentLabelGridSpec;
  /** Text vlastníka na štítku (prázdný = bez řádku vlastníka). */
  ownerText: string;
};

function defaultSettings(): EquipmentLabelGridSettings {
  return {
    templateKey: DEFAULT_EQUIPMENT_LABEL_TEMPLATE,
    useCustom: false,
    customSpec: getTemplateSpec(DEFAULT_EQUIPMENT_LABEL_TEMPLATE),
    ownerText: DEFAULT_LABEL_OWNER_TEXT,
  };
}

function parseSettings(raw: string | null | undefined): EquipmentLabelGridSettings {
  const fallback = defaultSettings();
  if (!raw?.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<EquipmentLabelGridSettings>;
    const templateKey = resolveEquipmentLabelTemplate(parsed.templateKey);
    const base = getTemplateSpec(templateKey);
    return {
      templateKey,
      useCustom: Boolean(parsed.useCustom),
      customSpec: normalizeEquipmentLabelGridSpec(parsed.customSpec, base),
      ownerText: normalizeLabelOwnerText(parsed.ownerText),
    };
  } catch {
    return fallback;
  }
}

export async function getEquipmentLabelGridSettings(): Promise<EquipmentLabelGridSettings> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: EQUIPMENT_LABEL_GRID_KEY },
    select: { setting_value: true },
  });
  return parseSettings(row?.setting_value);
}

/** Aktivní mřížka a text vlastníka pro tisk — vždy podle uloženého nastavení (jeden formát pro vše). */
export async function resolveEquipmentLabelGrid(): Promise<{
  settings: EquipmentLabelGridSettings;
  spec: EquipmentLabelGridSpec;
}> {
  const settings = await getEquipmentLabelGridSettings();
  return { settings, spec: activeLabelGridSpec(settings) };
}

/** Normalizuje vstup z formuláře na uložitelná nastavení (bez zápisu). */
export function buildEquipmentLabelGridSettings(input: {
  templateKey?: string;
  useCustom?: boolean;
  customSpec?: Partial<EquipmentLabelGridSpec>;
  ownerText?: unknown;
}): EquipmentLabelGridSettings {
  const templateKey = resolveEquipmentLabelTemplate(input.templateKey);
  const base = getTemplateSpec(templateKey);
  return {
    templateKey,
    useCustom: Boolean(input.useCustom),
    customSpec: normalizeEquipmentLabelGridSpec(input.customSpec ?? base, base),
    ownerText: normalizeLabelOwnerText(input.ownerText),
  };
}

/** Mřížka, podle které se tiskne: vlastní rozměry, nebo zvolená šablona. */
export function activeLabelGridSpec(settings: EquipmentLabelGridSettings): EquipmentLabelGridSpec {
  return settings.useCustom ? settings.customSpec : getTemplateSpec(settings.templateKey);
}

export async function setEquipmentLabelGridSettings(
  next: EquipmentLabelGridSettings,
  updatedBy?: number
): Promise<EquipmentLabelGridSettings> {
  await prisma.system_settings.upsert({
    where: { setting_key: EQUIPMENT_LABEL_GRID_KEY },
    create: {
      setting_key: EQUIPMENT_LABEL_GRID_KEY,
      setting_value: JSON.stringify(next),
      module: MODULE,
      description: "Mřížka A4 pro tisk QR štítků majetku a místností",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(next),
      module: MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });

  return next;
}

export function listEquipmentLabelTemplates() {
  return (Object.keys(EQUIPMENT_LABEL_TEMPLATES) as EquipmentLabelTemplateKey[]).map((key) => {
    const t = EQUIPMENT_LABEL_TEMPLATES[key];
    return {
      key,
      label: t.label,
      labelsPerPage: t.spec.cols * t.spec.rows,
      spec: t.spec,
    };
  });
}
