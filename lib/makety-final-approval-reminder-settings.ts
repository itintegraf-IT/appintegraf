import { prisma } from "@/lib/db";

export const MAKETY_FINAL_APPROVAL_REMINDER_KEY = "makety_final_approval_reminder";
export const MAKETY_FINAL_APPROVAL_REMINDER_MODULE = "makety";

export type FinalApprovalReminderSettings = {
  /** Globálně zapnuté automatické připomínky (cron). */
  enabled: boolean;
  /** Interval mezi připomínkami v hodinách. */
  interval_hours: number;
};

export const DEFAULT_FINAL_APPROVAL_REMINDER_SETTINGS: FinalApprovalReminderSettings = {
  enabled: true,
  interval_hours: 24,
};

export function parseFinalApprovalReminderSettings(
  raw: string | null | undefined
): FinalApprovalReminderSettings {
  if (!raw?.trim()) return { ...DEFAULT_FINAL_APPROVAL_REMINDER_SETTINGS };
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    const hoursRaw = Number(data.interval_hours);
    const interval_hours =
      Number.isFinite(hoursRaw) && hoursRaw >= 1
        ? Math.min(168, Math.floor(hoursRaw))
        : DEFAULT_FINAL_APPROVAL_REMINDER_SETTINGS.interval_hours;
    return {
      enabled: data.enabled !== false,
      interval_hours,
    };
  } catch {
    return { ...DEFAULT_FINAL_APPROVAL_REMINDER_SETTINGS };
  }
}

export async function loadFinalApprovalReminderSettings(): Promise<FinalApprovalReminderSettings> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: MAKETY_FINAL_APPROVAL_REMINDER_KEY },
    select: { setting_value: true },
  });
  return parseFinalApprovalReminderSettings(row?.setting_value);
}

export async function saveFinalApprovalReminderSettings(
  settings: FinalApprovalReminderSettings,
  updatedBy?: number
): Promise<FinalApprovalReminderSettings> {
  const hoursRaw = Number(settings.interval_hours);
  const next: FinalApprovalReminderSettings = {
    enabled: settings.enabled !== false,
    interval_hours:
      Number.isFinite(hoursRaw) && hoursRaw >= 1
        ? Math.min(168, Math.floor(hoursRaw))
        : DEFAULT_FINAL_APPROVAL_REMINDER_SETTINGS.interval_hours,
  };
  await prisma.system_settings.upsert({
    where: { setting_key: MAKETY_FINAL_APPROVAL_REMINDER_KEY },
    create: {
      setting_key: MAKETY_FINAL_APPROVAL_REMINDER_KEY,
      setting_value: JSON.stringify(next),
      module: MAKETY_FINAL_APPROVAL_REMINDER_MODULE,
      description: "Připomínky finálního schválení po softproof approve klientem",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(next),
      module: MAKETY_FINAL_APPROVAL_REMINDER_MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });
  return next;
}
