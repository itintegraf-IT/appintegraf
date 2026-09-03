import { prisma } from "@/lib/db";
import {
  MAKETY_SPRAVA_VZORKU_NOTIFY_KEY,
  MAKETY_SPRAVA_VZORKU_NOTIFY_MODULE,
  parseSpravaVzorkuNotifyTemplateJson,
  sanitizeSpravaVzorkuNotifyTemplate,
  type SpravaVzorkuNotifyTemplate,
} from "@/lib/makety-sprava-vzorku-template";

export async function loadSpravaVzorkuNotifyTemplate(): Promise<SpravaVzorkuNotifyTemplate> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: MAKETY_SPRAVA_VZORKU_NOTIFY_KEY },
    select: { setting_value: true },
  });
  return parseSpravaVzorkuNotifyTemplateJson(row?.setting_value);
}

export async function saveSpravaVzorkuNotifyTemplate(
  template: SpravaVzorkuNotifyTemplate,
  updatedBy?: number
): Promise<SpravaVzorkuNotifyTemplate> {
  const sanitized = sanitizeSpravaVzorkuNotifyTemplate(template);
  if (!sanitized) {
    throw new Error("Šablona musí obsahovat předmět, titulek a text zprávy");
  }
  await prisma.system_settings.upsert({
    where: { setting_key: MAKETY_SPRAVA_VZORKU_NOTIFY_KEY },
    create: {
      setting_key: MAKETY_SPRAVA_VZORKU_NOTIFY_KEY,
      setting_value: JSON.stringify(sanitized),
      module: MAKETY_SPRAVA_VZORKU_NOTIFY_MODULE,
      description: "Šablona notifikace správy vzorků při úpravě dat grafiky",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(sanitized),
      module: MAKETY_SPRAVA_VZORKU_NOTIFY_MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });
  return sanitized;
}
